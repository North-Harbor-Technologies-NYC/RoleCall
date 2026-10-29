// POST /api/jobs/:id/build-resume  Sets action=Apply and fires the routine's API trigger with a payload naming the row,
// so the resume and outreach are built now instead of at the next scheduled run. Needs ROUTINE_FIRE_URL and ROUTINE_FIRE_TOKEN.
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { sql, ensureSchema } from '@/lib/db';
import { FIXTURES, getJob } from '@/lib/queries';

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth(); if (!session?.user?.email) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await ctx.params;
  if (FIXTURES) { const j = await getJob(id); if (!j) return NextResponse.json({ error: 'not found' }, { status: 404 }); j.action = 'Apply'; return NextResponse.json({ ok: true, queued: true, fired: false, fixtures: true }); }
  await ensureSchema();
  const rows = await sql`update jobs set action = 'Apply', updated_at = now() where id = ${id} returning id, company, role, url`;
  if (!rows.length) return NextResponse.json({ error: 'not found' }, { status: 404 });
  const job = rows[0];
  const fireUrl = process.env.ROUTINE_FIRE_URL, fireToken = process.env.ROUTINE_FIRE_TOKEN;
  if (!fireUrl || !fireToken) {
    await sql`insert into events (job_id, kind, detail, actor) values (${id}, 'resume.queued', ${JSON.stringify({ note: 'no fire trigger configured; next scheduled run builds it' })}::jsonb, ${session.user.email})`;
    return NextResponse.json({ ok: true, queued: true, fired: false });
  }
  const text = `BUILD RESUME NOW. Run only jobops-resume and jobops-outreach for the tracker row with id "${job.id}" (${job.company}, ${job.role}, ${job.url}). Skip intake, evaluate, and the full digest. When done, post the resume links to the dashboard with the ingest API and send the owner a short email with the review and submit links. Do not touch any other row.`;
  const res = await fetch(fireUrl, { method: 'POST', headers: { authorization: `Bearer ${fireToken}`, 'anthropic-beta': 'experimental-cc-routine-2026-04-01', 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  const body = await res.json().catch(() => ({}));
  await sql`insert into events (job_id, kind, detail, actor) values (${id}, ${res.ok ? 'resume.fired' : 'resume.fire_failed'}, ${JSON.stringify({ status: res.status, session: body.claude_code_session_url || null })}::jsonb, ${session.user.email})`;
  if (!res.ok) return NextResponse.json({ ok: false, fired: false, status: res.status, error: body }, { status: 502 });
  return NextResponse.json({ ok: true, fired: true, session_url: body.claude_code_session_url || null });
}
