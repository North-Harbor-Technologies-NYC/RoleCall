#!/usr/bin/env node
// boards.mjs: zero-token scan of the Ashby, Greenhouse, and Lever boards listed in
// portals/portals.yml. Prints normalized jobs as JSON to stdout. No LLM involved.
// Superseded by portals/scan.mjs (boards plus career sites, written to feeds/); kept for one-off checks.
//
//   node portals/boards.mjs                 # all boards, title filter applied
//   node portals/boards.mjs --no-filter     # all titles
//   node portals/boards.mjs --company Runway
//
// Output: { scanned, jobs: [{title,url,company,location,board,tier}], blocked: [{company,title,location,rule}], errors }
// jobs are sorted by tier (1 first); the evaluator scores in this order so the daily cap goes to the best candidates.
// Title filter comes from portals.yml; hard location/seniority/function rules from rubric/blockers.yml.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { makeHttpCtx } from './providers/_http.mjs';
import ashby from './providers/ashby.mjs';
import greenhouse from './providers/greenhouse.mjs';
import lever from './providers/lever.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = yaml.load(readFileSync(path.join(here, 'portals.yml'), 'utf-8'));
const args = process.argv.slice(2);
const noFilter = args.includes('--no-filter');
const onlyIdx = args.indexOf('--company');
const only = onlyIdx !== -1 ? (args[onlyIdx + 1] || '').toLowerCase() : null;

const blockers = yaml.load(readFileSync(path.join(here, '..', 'rubric', 'blockers.yml'), 'utf-8'));
const hardRules = (blockers.hard || []).filter(r => Array.isArray(r.patterns));
const requireRules = hardRules.filter(r => Array.isArray(r.require_any_in));
const blockRules = hardRules.filter(r => Array.isArray(r.match_any_in));

// Returns the id of the first hard rule tripped, or null. Only simple pattern rules
// (match_any_in) run here; multi-condition rules are left to the evaluator.
function blockedBy(job) {
  for (const r of requireRules) {
    const hay = r.require_any_in.map(f => String(job[f] || '')).join(' | ').toLowerCase();
    if (!r.patterns.some(p => hay.includes(String(p).toLowerCase()))) return r.id;
  }
  for (const r of blockRules) {
    const fields = (r.match_any_in || []).filter(f => f !== 'description');
    const hay = fields.map(f => String(job[f] || '')).join(' | ').toLowerCase();
    if (r.patterns.some(p => hay.includes(String(p).toLowerCase()))) return r.id;
  }
  return null;
}

const providers = [ashby, greenhouse, lever];
const ctx = makeHttpCtx();
const pos = (config.title_filter?.positive || []).map(s => s.toLowerCase());
const neg = (config.title_filter?.negative || []).map(s => s.toLowerCase());

function passesTitle(title) {
  const t = (title || '').toLowerCase();
  if (neg.some(n => t.includes(n))) return false;
  return pos.some(p => t.includes(p));
}

// Relevance tier for scoring order (1 = score first). Mirrors the tiers in .claude/skills/jobops-evaluate.
const TIER1 = ['post-production','post production','content operations','content ops','media operations','media ops','production operations','studio','creative operations','creative ops','video','multimedia','programming','head of content','vp, content','vp content','broadcast','localization','dubbing','production technology','content supply','ai content','ai creative','generative','ai transformation','applied ai','head of ai','vp, ai','vp ai','head of production','vp, production','vp production','director, production','director of production','executive producer'];
const TIER2 = ['media','entertainment','creative','brand partnerships','content','partnerships','enterprise account','strategic account','account executive','solutions'];
function tierOf(title) {
  const t = (title || '').toLowerCase();
  if (TIER1.some(k => t.includes(k))) return 1;
  if (TIER2.some(k => t.includes(k))) return 2;
  return 3;
}

const out = { scanned: [], jobs: [], blocked: [], errors: [] };
for (const entry of config.tracked_companies || []) {
  if (entry.enabled === false) continue;
  if (only && !entry.name.toLowerCase().includes(only)) continue;
  const provider = providers.find(p => p.detect(entry));
  if (!provider) continue; // not an API board; the agentic scrub covers it
  try {
    const jobs = await provider.fetch(entry, ctx);
    out.scanned.push({ company: entry.name, board: provider.id, count: jobs.length });
    for (const j of jobs) {
      if (!noFilter && !passesTitle(j.title)) continue;
      const rule = noFilter ? null : blockedBy(j);
      if (rule) { out.blocked.push({ company: j.company, title: j.title, location: j.location, rule }); continue; }
      out.jobs.push({ ...j, board: provider.id, tier: tierOf(j.title) });
    }
  } catch (e) {
    out.errors.push({ company: entry.name, board: provider.id, error: String(e.message || e) });
  }
}
out.jobs.sort((a, b) => a.tier - b.tier || a.company.localeCompare(b.company));
process.stdout.write(JSON.stringify(out, null, 2) + '\n');
