#!/usr/bin/env node
// Thin client for the RoleCall dashboard API. Used by the routine skills and the feed Action.
//   node scripts/rolecall.mjs jobs  runs/2026-10-14/evaluated.json      # upsert tracker rows (array of row objects, or {jobs:[...]})
//   node scripts/rolecall.mjs run   runs/2026-10-14/run.json            # {run_date, started_at, finished_at, summary, digest}
//   node scripts/rolecall.mjs feed  feeds/latest.json                   # the feed file as is
//   node scripts/rolecall.mjs contacts runs/2026-10-14/outreach/x.json  # {job_id, contacts:[{name,title,channel,url,draft}]}
//   node scripts/rolecall.mjs apply                                     # print rows with action=Apply (JSON)
//   node scripts/rolecall.mjs known                                     # print every row: id, company, role, url, status, action, score, dates, contact (dedupe and digest)
// Needs ROLECALL_URL (https://host) and ROLECALL_TOKEN in the environment. Exits 0 with a note when they are missing,
// so a run without the dashboard configured still completes.
import { readFileSync } from 'fs';

const [cmd, file] = process.argv.slice(2);
const base = (process.env.ROLECALL_URL || '').replace(/\/$/, '');
const token = process.env.ROLECALL_TOKEN || '';
if (!base || !token) { console.error('rolecall: ROLECALL_URL or ROLECALL_TOKEN not set; skipping'); process.exit(0); }

async function call(method, path, body) {
  const res = await fetch(`${base}${path}`, { method, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) { console.error(`rolecall: ${method} ${path} -> ${res.status} ${text.slice(0, 300)}`); process.exit(1); }
  return text ? JSON.parse(text) : {};
}
const load = () => JSON.parse(readFileSync(file, 'utf-8'));

let out;
switch (cmd) {
  case 'jobs': { const d = load(); const jobs = Array.isArray(d) ? d : d.jobs; out = await call('POST', '/api/ingest/jobs', { jobs }); break; }
  case 'run': out = await call('POST', '/api/ingest/runs', load()); break;
  case 'feed': out = await call('POST', '/api/ingest/feed', load()); break;
  case 'contacts': out = await call('POST', '/api/ingest/contacts', load()); break;
  case 'apply': out = await call('GET', '/api/ingest/jobs?action=Apply'); break;
  case 'known': out = await call('GET', '/api/ingest/jobs'); break;
  default: console.error('usage: rolecall.mjs jobs|run|feed|contacts|apply|known [file]'); process.exit(2);
}
console.log(JSON.stringify(out, null, 1));
