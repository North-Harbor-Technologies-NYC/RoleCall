import { sql, ensureSchema, type Job } from '@/lib/db';
import { JOBS, RUNS, FEED } from '@/lib/fixtures';

// RC_FIXTURES=1 serves the sample data in lib/fixtures.ts instead of the database: local screenshots and the public demo.
export const FIXTURES = process.env.RC_FIXTURES === '1';
const likeOf = (q: string) => `%${q}%`;
const matches = (j: { company: string; role?: string; title?: string }, q: string) => !q || [j.company, j.role, j.title].some(s => (s || '').toLowerCase().includes(q.toLowerCase()));

// Today: every undecided role at 3.5 or above. Strong matches (4.0+) first so one never sits under a maybe,
// then newest first, then best first within a day.
export async function todayQueue(): Promise<Job[]> {
  if (FIXTURES) return JOBS.filter(j => j.status === 'Evaluated' && Number(j.score) >= 3.5 && !j.action).sort((a, b) => (Number(b.score) >= 4 ? 1 : 0) - (Number(a.score) >= 4 ? 1 : 0) || String(b.date_found).localeCompare(String(a.date_found)) || Number(b.score) - Number(a.score));
  await ensureSchema();
  const rows = await sql`select * from jobs where status = 'Evaluated' and score >= 3.5 and action = '' order by (score >= 4) desc, date_found desc, score desc, company`;
  return rows as unknown as Job[];
}
// Roles decided today (action set or status moved today), for the progress segments.
export async function decidedToday(): Promise<Job[]> {
  if (FIXTURES) return JOBS.filter(j => j.status === 'Evaluated' && Number(j.score) >= 3.5 && !!j.action);
  await ensureSchema();
  const rows = await sql`select * from jobs where score >= 3.5 and ((status = 'Evaluated' and action <> '') or (status in ('Applied','SKIP') and updated_at >= current_date)) and updated_at >= current_date - 1 order by updated_at desc`;
  return rows as unknown as Job[];
}

export type PipelineFilter = 'queue' | 'applied' | 'responded' | 'interview' | 'offer' | 'skipped' | 'all';
export const PIPELINE_FILTERS: { key: PipelineFilter; label: string; tone: string }[] = [
  { key: 'queue', label: 'Apply queue', tone: 'fit' }, { key: 'applied', label: 'Applied', tone: 'progress' }, { key: 'responded', label: 'Responded', tone: 'responded' },
  { key: 'interview', label: 'Interview', tone: 'interview' }, { key: 'offer', label: 'Offer', tone: 'fit' }, { key: 'skipped', label: 'Skipped', tone: 'neutral' }, { key: 'all', label: 'All', tone: 'ink' },
];

export async function listPipeline(filter: PipelineFilter, q = ''): Promise<Job[]> {
  if (FIXTURES) {
    const f = (j: Job) => filter === 'queue' ? (j.status === 'Evaluated' && ['Apply', 'Hold'].includes(j.action)) : filter === 'skipped' ? (['SKIP', 'Rejected', 'Discarded'].includes(j.status) || j.action === 'Skip') : filter === 'all' ? true : j.status.toLowerCase() === filter;
    return JOBS.filter(j => f(j) && matches(j, q));
  }
  await ensureSchema();
  const like = likeOf(q); const noQ = !q;
  let rows;
  switch (filter) {
    case 'queue': rows = await sql`select * from jobs where action in ('Apply', 'Hold') and status = 'Evaluated' and (${noQ} or company ilike ${like} or role ilike ${like}) order by action, score desc nulls last`; break;
    case 'applied': rows = await sql`select * from jobs where status = 'Applied' and (${noQ} or company ilike ${like} or role ilike ${like}) order by coalesce(last_touch, applied_date) desc nulls last, score desc nulls last`; break;
    case 'responded': rows = await sql`select * from jobs where status = 'Responded' and (${noQ} or company ilike ${like} or role ilike ${like}) order by coalesce(last_touch, applied_date) desc nulls last`; break;
    case 'interview': rows = await sql`select * from jobs where status = 'Interview' and (${noQ} or company ilike ${like} or role ilike ${like}) order by coalesce(last_touch, applied_date) desc nulls last`; break;
    case 'offer': rows = await sql`select * from jobs where status = 'Offer' and (${noQ} or company ilike ${like} or role ilike ${like}) order by coalesce(last_touch, applied_date) desc nulls last`; break;
    case 'skipped': rows = await sql`select * from jobs where (status in ('SKIP', 'Rejected', 'Discarded') or action = 'Skip') and (${noQ} or company ilike ${like} or role ilike ${like}) order by date_found desc, score desc nulls last limit 500`; break;
    default: rows = await sql`select * from jobs where (${noQ} or company ilike ${like} or role ilike ${like}) order by coalesce(last_touch, applied_date, date_found) desc nulls last, score desc nulls last limit 500`;
  }
  return rows as unknown as Job[];
}

export async function pipelineCounts(): Promise<Record<PipelineFilter, number>> {
  if (FIXTURES) { const c = {} as Record<PipelineFilter, number>; for (const f of PIPELINE_FILTERS) c[f.key] = (await listPipeline(f.key)).length; return c; }
  await ensureSchema();
  const r = await sql`select
    count(*) filter (where action in ('Apply','Hold') and status = 'Evaluated')::int as queue,
    count(*) filter (where status = 'Applied')::int as applied,
    count(*) filter (where status = 'Responded')::int as responded,
    count(*) filter (where status = 'Interview')::int as interview,
    count(*) filter (where status = 'Offer')::int as offer,
    count(*) filter (where status in ('SKIP','Rejected','Discarded') or action = 'Skip')::int as skipped,
    count(*)::int as all from jobs`;
  const o = r[0] || {};
  return { queue: Number(o.queue || 0), applied: Number(o.applied || 0), responded: Number(o.responded || 0), interview: Number(o.interview || 0), offer: Number(o.offer || 0), skipped: Number(o.skipped || 0), all: Number(o.all || 0) };
}

export type Needs = { noDate: number; stale: number; due: number; stages: Record<string, number> };
export async function needs(): Promise<Needs> {
  if (FIXTURES) {
    const stages: Record<string, number> = {}; for (const j of JOBS) stages[j.status] = (stages[j.status] || 0) + 1;
    return { noDate: JOBS.filter(j => j.status === 'Applied' && !j.applied_date).length, stale: JOBS.filter(j => j.status === 'Applied' && j.applied_date && Date.now() - new Date(j.applied_date).getTime() > 21 * 86400000 && !j.last_touch).length, due: JOBS.filter(j => ['Applied', 'Responded', 'Interview'].includes(j.status) && j.next_followup && j.next_followup <= new Date().toISOString().slice(0, 10)).length, stages };
  }
  await ensureSchema();
  const rows = await sql`select status, count(*)::int as n from jobs group by status`;
  const stages: Record<string, number> = {}; for (const r of rows) stages[String(r.status)] = Number(r.n);
  const r = await sql`select
    count(*) filter (where status = 'Applied' and applied_date is null)::int as nodate,
    count(*) filter (where status = 'Applied' and coalesce(last_touch, applied_date) < current_date - 21)::int as stale,
    count(*) filter (where status in ('Applied','Responded','Interview') and next_followup <= current_date)::int as due
    from jobs`;
  const o = r[0] || {};
  return { noDate: Number(o.nodate || 0), stale: Number(o.stale || 0), due: Number(o.due || 0), stages };
}

export async function navCounts(): Promise<{ today: number; needs: number; feedNew: number }> {
  if (FIXTURES) { const n = await needs(); return { today: (await todayQueue()).length, needs: n.noDate + n.stale + n.due, feedNew: FEED.filter(f => f.is_new).length }; }
  await ensureSchema();
  const r = await sql`select
    (select count(*) from jobs where status = 'Evaluated' and score >= 3.5 and action = '')::int as today,
    (select count(*) from jobs where status = 'Applied' and (applied_date is null or coalesce(last_touch, applied_date) < current_date - 21))::int as stale,
    (select count(*) from jobs where status in ('Applied','Responded','Interview') and next_followup <= current_date)::int as due,
    (select count(*) from feed where is_new)::int as feednew`;
  const o = r[0] || {};
  return { today: Number(o.today || 0), needs: Number(o.stale || 0) + Number(o.due || 0), feedNew: Number(o.feednew || 0) };
}

export async function getJob(id: string): Promise<Job | null> {
  if (FIXTURES) return JOBS.find(j => j.id === id) || null;
  await ensureSchema();
  const rows = await sql`select * from jobs where id = ${id}`;
  return (rows[0] as Job) || null;
}

export async function listFeed(opts: { newOnly: boolean; tier: number | null; q: string }) {
  if (FIXTURES) {
    const rows = FEED.filter(f => (!opts.newOnly || f.is_new) && (opts.tier === null || f.tier === opts.tier) && matches(f as { company: string; title: string }, opts.q));
    return { rows, meta: { day: new Date().toISOString().slice(0, 10), total: 3482, fresh: FEED.filter(f => f.is_new).length } };
  }
  await ensureSchema();
  const like = likeOf(opts.q);
  const rows = await sql`select f.*, j.id as job_id, j.score as job_score, j.status as job_status from feed f
    left join jobs j on j.url = f.url
    where (${!opts.newOnly} or f.is_new)
      and (${opts.tier === null} or f.tier = ${opts.tier ?? 0})
      and (${!opts.q} or f.company ilike ${like} or f.title ilike ${like})
    order by f.is_new desc, f.tier, f.first_seen desc, f.company limit 600`;
  const meta = await sql`select max(last_seen) as day, count(*)::int as total, sum(case when is_new then 1 else 0 end)::int as fresh from feed`;
  return { rows, meta: meta[0] };
}

export async function listRuns() {
  if (FIXTURES) return RUNS.map(r => ({ ...r, has_digest: !!r.digest }));
  await ensureSchema();
  return sql`select run_date, started_at, finished_at, summary, (digest is not null) as has_digest from runs order by run_date desc limit 60`;
}

export async function getRun(day: string) {
  if (FIXTURES) return RUNS.find(r => r.run_date === day) || null;
  await ensureSchema();
  const rows = await sql`select * from runs where run_date = ${day}::date`;
  return rows[0] || null;
}
export async function latestRun() {
  if (FIXTURES) return RUNS[0];
  await ensureSchema();
  const rows = await sql`select * from runs order by run_date desc limit 1`;
  return rows[0] || null;
}
// Rows the routine posted on a given day, for the Run day page (kept and skipped lists).
export async function jobsForDay(day: string): Promise<Job[]> {
  if (FIXTURES) return JOBS.filter(j => j.date_found === day);
  await ensureSchema();
  const rows = await sql`select * from jobs where date_found = ${day}::date order by score desc nulls last, company`;
  return rows as unknown as Job[];
}

export async function recentEvents(jobId: string) {
  if (FIXTURES) return [{ kind: 'job.created', detail: { score: 4.1 }, actor: 'routine', created_at: new Date().toISOString() }];
  await ensureSchema();
  return sql`select kind, detail, actor, created_at from events where job_id = ${jobId} order by created_at desc limit 20`;
}

export async function contactsFor(jobId: string) {
  if (FIXTURES) return [];
  await ensureSchema();
  return sql`select * from contacts where job_id = ${jobId} order by created_at`;
}
