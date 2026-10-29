// POST /api/ingest/runs { run_date, started_at?, finished_at?, summary?, digest? }  Upserts one run record.
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { checkIngest, guarded } from '@/lib/ingest';

export async function POST(req: Request) {
  const denied = checkIngest(req); if (denied) return denied;
  return guarded(async () => {
  await ensureSchema();
  const b = await req.json().catch(() => null);
  if (!b?.run_date) return NextResponse.json({ error: 'run_date required' }, { status: 400 });
  const summary = b.summary === undefined ? null : JSON.stringify(b.summary);
  const digest = b.digest === undefined ? null : JSON.stringify(b.digest);
  await sql`insert into runs (run_date, started_at, finished_at, summary, digest)
    values (${b.run_date}::date, ${b.started_at || null}::timestamptz, ${b.finished_at || null}::timestamptz, ${summary}::jsonb, ${digest}::jsonb)
    on conflict (run_date) do update set
      started_at = coalesce(excluded.started_at, runs.started_at), finished_at = coalesce(excluded.finished_at, runs.finished_at),
      summary = coalesce(excluded.summary, runs.summary), digest = coalesce(excluded.digest, runs.digest)`;
  return NextResponse.json({ ok: true });
  });
}
