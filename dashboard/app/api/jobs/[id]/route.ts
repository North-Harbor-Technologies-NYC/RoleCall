// PATCH /api/jobs/:id  { action?, status?, applied_date?, last_touch?, next_followup?, contact?, notes?, checks? }  the owner's columns only.
// Only keys present in the body change; an explicit null or "" clears the column.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql, ensureSchema, STATUSES, ACTIONS } from '@/lib/db';
import { FIXTURES, getJob } from '@/lib/queries';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({})) as Record<string, unknown>;
  if (FIXTURES) { const j = await getJob(id); if (!j) return NextResponse.json({ error: 'not found' }, { status: 404 }); Object.assign(j, b); return NextResponse.json({ job: j, fixtures: true }); }
  await ensureSchema();
  if (b.status !== undefined && !(STATUSES as readonly string[]).includes(String(b.status))) return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  if (b.action !== undefined && !(ACTIONS as readonly string[]).includes(String(b.action ?? ''))) return NextResponse.json({ error: 'action must be Apply, Skip, Hold, or empty' }, { status: 400 });

  const has = (k: string) => Object.prototype.hasOwnProperty.call(b, k);
  if (has('checks') && b.checks !== null && !Array.isArray(b.checks)) return NextResponse.json({ error: 'checks must be an array of {text, done}' }, { status: 400 });
  const checks = !has('checks') || b.checks === null ? null : JSON.stringify((b.checks as unknown[]).filter(c => c && typeof (c as { text?: unknown }).text === 'string').map(c => ({ text: String((c as { text: string }).text), done: !!(c as { done?: unknown }).done })));
  const val = (k: string): string | null => (b[k] === undefined || b[k] === null || b[k] === '' ? null : String(b[k]));

  let setApplied = has('applied_date'), applied = val('applied_date');
  let setFollowup = has('next_followup'), followup = val('next_followup');
  let setTouch = has('last_touch'), touch = val('last_touch');
  if (b.status === 'Applied') {
    // Marking Applied stamps the date and the first follow-up (7 days) unless the body supplies them.
    const today = new Date().toISOString().slice(0, 10);
    if (!setApplied) { setApplied = true; applied = today; }
    if (!setTouch) { setTouch = true; touch = applied || today; }
    if (!setFollowup) { setFollowup = true; const dt = new Date(applied || today); dt.setDate(dt.getDate() + 7); followup = dt.toISOString().slice(0, 10); }
  }

  let rows;
  try {
    rows = await sql`update jobs set
      status = case when ${has('status')}::boolean then ${val('status')}::text else status end,
      action = case when ${has('action')}::boolean then coalesce(${val('action')}::text, '') else action end,
      applied_date = case when ${setApplied}::boolean then ${applied}::date else applied_date end,
      last_touch = case when ${setTouch}::boolean then ${touch}::date else last_touch end,
      next_followup = case when ${setFollowup}::boolean then ${followup}::date else next_followup end,
      contact = case when ${has('contact')}::boolean then ${val('contact')}::text else contact end,
      notes = case when ${has('notes')}::boolean then ${val('notes')}::text else notes end,
      checks = case when ${has('checks')}::boolean then ${checks}::jsonb else checks end,
      updated_at = now()
    where id = ${id} returning *`;
  } catch (e) {
    return NextResponse.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  await sql`insert into events (job_id, kind, detail, actor) values (${id}, 'job.edited', ${JSON.stringify(b)}::jsonb, ${session.user.email})`;
  return NextResponse.json({ job: rows[0] });
}
