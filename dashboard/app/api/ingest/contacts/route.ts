// POST /api/ingest/contacts { job_id, contacts: [ {name, title, channel, url, draft} ] }  Replaces the job's outreach contacts.
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { checkIngest, guarded } from '@/lib/ingest';

export async function POST(req: Request) {
  const denied = checkIngest(req); if (denied) return denied;
  return guarded(async () => {
  await ensureSchema();
  const b = await req.json().catch(() => null);
  const jobId = String(b?.job_id || ''); const list: Record<string, unknown>[] = Array.isArray(b?.contacts) ? b.contacts : [];
  if (!jobId) return NextResponse.json({ error: 'job_id required' }, { status: 400 });
  const exists = await sql`select id from jobs where id = ${jobId}`;
  if (!exists.length) return NextResponse.json({ error: 'job not found' }, { status: 404 });
  await sql`delete from contacts where job_id = ${jobId}`;
  for (const c of list) await sql`insert into contacts (job_id, name, title, channel, url, draft) values (${jobId}, ${String(c.name || '')}, ${String(c.title || '')}, ${String(c.channel || '')}, ${String(c.url || '')}, ${String(c.draft || '')})`;
  await sql`insert into events (job_id, kind, detail, actor) values (${jobId}, 'outreach.drafted', ${JSON.stringify({ count: list.length })}::jsonb, 'routine')`;
  return NextResponse.json({ ok: true, count: list.length });
  });
}
