// POST /api/ingest/jobs  { jobs: [ {id, company, role, ...routine columns, fit?, watch?, checks?} ], import?: true }
// With import: true (one-time migration from the Sheet) the owner's columns on the incoming row are written too, on insert only.
// Upserts rows. Routine columns are overwritten only when the incoming value is non-empty; the owner's columns are never touched,
// except that a brand-new row takes the incoming status. Returns counts.
import { NextResponse } from 'next/server';
import { sql, ensureSchema, ROUTINE_COLS } from '@/lib/db';
import { checkIngest, guarded } from '@/lib/ingest';

export async function POST(req: Request) {
  const denied = checkIngest(req); if (denied) return denied;
  return guarded(async () => {
  await ensureSchema();
  const body = await req.json().catch(() => null);
  const jobs: Record<string, unknown>[] = Array.isArray(body?.jobs) ? body.jobs : [];
  const isImport = body?.import === true;
  if (!jobs.length) return NextResponse.json({ error: 'jobs[] required' }, { status: 400 });
  let inserted = 0, updated = 0; const errors: string[] = [];
  for (const j of jobs) {
    const id = String(j.id || '').trim(); if (!id || !j.company || !j.role) { errors.push(`skipped row without id/company/role: ${JSON.stringify(j).slice(0, 80)}`); continue; }
    const existing = await sql`select id from jobs where id = ${id}`;
    const v = (k: string) => (j[k] === undefined || j[k] === null || j[k] === '' ? null : j[k]);
    const flags = j.flags === undefined ? null : JSON.stringify(j.flags);
    // checks: [{text, done}] or ["text", ...]. The routine's list is written only when the row has none yet, so the owner's ticks survive re-posts.
    const checks = !Array.isArray(j.checks) ? null : JSON.stringify((j.checks as unknown[]).map(c => typeof c === 'string' ? { text: c, done: false } : c).filter(c => c && typeof (c as { text?: unknown }).text === 'string'));
    const score = v('score') === null ? null : Number(j.score);
    const tier = v('tier') === null ? null : Number(j.tier);
    if (existing.length) {
      await sql`update jobs set
        date_found = coalesce(${v('date_found')}::date, date_found), company = coalesce(${v('company')}, company), role = coalesce(${v('role')}, role),
        url = coalesce(${v('url')}, url), alert_url = coalesce(${v('alert_url')}, alert_url), source = coalesce(${v('source')}, source),
        location = coalesce(${v('location')}, location), comp = coalesce(${v('comp')}, comp), tier = coalesce(${tier}::int, tier),
        archetype = coalesce(${v('archetype')}, archetype), score = coalesce(${score}::numeric, score), score_breakdown = coalesce(${v('score_breakdown')}, score_breakdown),
        legitimacy = coalesce(${v('legitimacy')}, legitimacy), resolution = coalesce(${v('resolution')}, resolution),
        resume_review = coalesce(${v('resume_review')}, resume_review), resume_submit = coalesce(${v('resume_submit')}, resume_submit),
        report = coalesce(${v('report')}, report), next_followup = coalesce(${v('next_followup')}::date, next_followup),
        reason = coalesce(${v('reason')}, reason), jd = coalesce(${v('jd')}, jd), flags = coalesce(${flags}::jsonb, flags),
        fit = coalesce(${v('fit')}, fit), watch = coalesce(${v('watch')}, watch),
        checks = case when ${checks !== null}::boolean and checks is null then ${checks}::jsonb else checks end,
        updated_at = now()
        where id = ${id}`;
      updated++;
    } else {
      await sql`insert into jobs (id, date_found, company, role, url, alert_url, source, location, comp, tier, archetype, score, score_breakdown, legitimacy, resolution, status, action, resume_review, resume_submit, report, applied_date, last_touch, next_followup, contact, reason, notes, jd, flags, fit, watch, checks)
        values (${id}, ${v('date_found')}::date, ${String(j.company)}, ${String(j.role)}, ${v('url')}, ${v('alert_url')}, ${v('source')}, ${v('location')}, ${v('comp')}, ${tier}::int, ${v('archetype')}, ${score}::numeric, ${v('score_breakdown')}, ${v('legitimacy')}, ${v('resolution')}, ${String(v('status') || 'Evaluated')}, ${isImport ? String(v('action') || '') : ''}, ${v('resume_review')}, ${v('resume_submit')}, ${v('report')}, ${isImport ? v('applied_date') : null}::date, ${isImport ? v('last_touch') : null}::date, ${v('next_followup')}::date, ${isImport ? v('contact') : null}, ${v('reason')}, ${isImport ? v('notes') : null}, ${v('jd')}, ${flags}::jsonb, ${v('fit')}, ${v('watch')}, ${checks}::jsonb)`;
      inserted++;
    }
    await sql`insert into events (job_id, kind, detail, actor) values (${id}, ${existing.length ? 'job.updated' : 'job.created'}, ${JSON.stringify({ score, status: v('status') })}::jsonb, 'routine')`;
  }
  void ROUTINE_COLS;
  return NextResponse.json({ inserted, updated, errors });
  });
}

// GET /api/ingest/jobs?action=Apply  -> rows the routine should act on (Apply with no resume yet), plus known ids for dedupe.
export async function GET(req: Request) {
  const denied = checkIngest(req); if (denied) return denied;
  return guarded(async () => {
  await ensureSchema();
  const url = new URL(req.url);
  const action = url.searchParams.get('action');
  if (action) {
    const rows = await sql`select * from jobs where action = ${action} order by score desc nulls last`;
    return NextResponse.json({ jobs: rows });
  }
  // Every row, without the heavy columns: the intake dedupes on it and the digest computes follow-ups and pipeline counts from it.
  const rows = await sql`select id, company, role, url, status, action, score, date_found, applied_date, last_touch, next_followup, contact from jobs order by date_found desc nulls last`;
  return NextResponse.json({ jobs: rows });
  });
}
