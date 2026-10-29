#!/usr/bin/env node
// scan.mjs: the zero-token daily feed. Pulls every board and career site we know how to read without an LLM,
// applies the title filter, hard blockers, and relevance tiers, and writes feeds/latest.json plus a dated copy.
//
//   node portals/scan.mjs                       # full scan, writes feeds/
//   node portals/scan.mjs --company Disney      # one company, prints to stdout, writes nothing
//   node portals/scan.mjs --dry                 # full scan, prints to stdout, writes nothing
//
// Sources: Ashby, Greenhouse, and Lever boards from portals/portals.yml (careers_url detection), and the
// ATS providers in portals/scan-targets.yml. Runs in GitHub Actions every weekday morning (.github/workflows/feed.yml)
// and can be run by hand. The routine reads feeds/latest.json instead of calling boards or scrubbing these sites.
//
// Output: { generated_at, scanned: [{company, provider, count, ms}], errors: [{company, provider, error}],
//           jobs: [{id, company, title, location, url, posted, source, provider, tier, first_seen, new}],
//           blocked: [{company, title, location, rule}], counts }
// `new` is true when the job id was not in the previous feeds/latest.json. `first_seen` carries over from it.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { makeHttpCtx } from './providers/_http.mjs';
import { ATS } from './providers/_ats.mjs';
import ashby from './providers/ashby.mjs';
import greenhouse from './providers/greenhouse.mjs';
import lever from './providers/lever.mjs';
import { config, passesTitle, blockedBy, tierOf } from './_filters.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const args = process.argv.slice(2);
const dry = args.includes('--dry');
const onlyIdx = args.indexOf('--company');
const only = onlyIdx !== -1 ? (args[onlyIdx + 1] || '').toLowerCase() : null;
const CONCURRENCY = Number(process.env.SCAN_CONCURRENCY || 6);

const targets = yaml.load(readFileSync(path.join(here, 'scan-targets.yml'), 'utf-8'));
const boardProviders = [ashby, greenhouse, lever];
const ctx = makeHttpCtx();

// Build the task list: boards from portals.yml, ATS targets from scan-targets.yml.
const tasks = [];
for (const entry of config.tracked_companies || []) {
  if (entry.enabled === false) continue;
  const provider = boardProviders.find(p => p.detect(entry));
  if (!provider) continue;
  tasks.push({ company: entry.name, provider: provider.id, run: () => provider.fetch(entry, ctx) });
}
for (const t of targets.targets || []) {
  if (t.enabled === false) continue;
  const fn = ATS[t.scan?.provider];
  if (!fn) { console.error(`scan: unknown provider ${t.scan?.provider} for ${t.name}`); continue; }
  tasks.push({ company: t.name, provider: t.scan.provider, exclude: (t.exclude || []).map(x => x.toLowerCase()), run: () => fn(t, ctx) });
}
const selected = only ? tasks.filter(t => t.company.toLowerCase().includes(only)) : tasks;

const idOf = j => createHash('sha1').update(`${j.company}|${j.title}|${j.url}`.toLowerCase()).digest('hex').slice(0, 16);
const normUrl = u => String(u || '').replace(/[?#].*$/, '').replace(/\/$/, '');

// Previous feed, for first_seen and new flags.
const feedDir = path.join(root, 'feeds');
const latestPath = path.join(feedDir, 'latest.json');
let prev = { jobs: [] };
if (existsSync(latestPath)) { try { prev = JSON.parse(readFileSync(latestPath, 'utf-8')); } catch { prev = { jobs: [] }; } }
const prevById = new Map((prev.jobs || []).map(j => [j.id, j]));

const out = { generated_at: new Date().toISOString(), scanned: [], errors: [], jobs: [], blocked: [], counts: {} };
const seenUrl = new Set();

async function runTask(t) {
  const t0 = Date.now();
  try {
    let jobs;
    try { jobs = await t.run(); }
    catch (e1) { await new Promise(r => setTimeout(r, 3000)); jobs = await t.run(); } // one retry for transient timeouts
    out.scanned.push({ company: t.company, provider: t.provider, count: jobs.length, ms: Date.now() - t0 });
    for (const j of jobs) {
      const url = normUrl(j.url); if (!url || seenUrl.has(url)) continue; seenUrl.add(url);
      const job = { company: j.company || t.company, title: (j.title || '').trim(), location: (j.location || '').trim(), url, posted: j.posted || '' };
      if (!passesTitle(job.title)) continue;
      if ((t.exclude || []).some(x => job.title.toLowerCase().includes(x))) continue;
      const rule = blockedBy(job);
      if (rule) { out.blocked.push({ company: job.company, title: job.title, location: job.location, rule }); continue; }
      const id = idOf(job); const p = prevById.get(id);
      out.jobs.push({ id, ...job, source: `scan:${t.provider}`, provider: t.provider, tier: tierOf(job.title), first_seen: p?.first_seen || out.generated_at.slice(0, 10), new: !p });
    }
  } catch (e) {
    out.errors.push({ company: t.company, provider: t.provider, error: String(e.message || e).slice(0, 200) });
  }
}

// Simple concurrency pool.
let i = 0;
await Promise.all(Array.from({ length: Math.min(CONCURRENCY, selected.length) }, async () => { while (i < selected.length) await runTask(selected[i++]); }));

out.jobs.sort((a, b) => a.tier - b.tier || (b.new - a.new) || a.company.localeCompare(b.company) || a.title.localeCompare(b.title));
out.counts = {
  sources: selected.length, ok: out.scanned.length, failed: out.errors.length,
  raw: out.scanned.reduce((n, s) => n + s.count, 0), passed: out.jobs.length, blocked: out.blocked.length,
  new: out.jobs.filter(j => j.new).length, by_tier: [1, 2, 3].map(t => out.jobs.filter(j => j.tier === t).length),
};

if (dry || only) { process.stdout.write(JSON.stringify(out, null, 2) + '\n'); }
else {
  mkdirSync(feedDir, { recursive: true });
  writeFileSync(latestPath, JSON.stringify(out, null, 1) + '\n');
  writeFileSync(path.join(feedDir, `${out.generated_at.slice(0, 10)}.json`), JSON.stringify(out, null, 1) + '\n');
  console.log(`feed: ${out.counts.passed} passed (${out.counts.new} new; tiers ${out.counts.by_tier.join('/')}), ${out.counts.blocked} blocked, ${out.counts.raw} raw from ${out.counts.ok}/${out.counts.sources} sources, ${out.counts.failed} failed`);
  for (const e of out.errors) console.log(`  failed: ${e.company} (${e.provider}): ${e.error}`);
}
