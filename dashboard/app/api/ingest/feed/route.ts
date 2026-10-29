// POST /api/ingest/feed  with the body of feeds/latest.json. Upserts feed rows; is_new mirrors the feed's own flag.
import { NextResponse } from 'next/server';
import { sql, ensureSchema } from '@/lib/db';
import { checkIngest, guarded } from '@/lib/ingest';

export async function POST(req: Request) {
  const denied = checkIngest(req); if (denied) return denied;
  return guarded(async () => {
  await ensureSchema();
  const feed = await req.json().catch(() => null);
  const jobs: Record<string, unknown>[] = Array.isArray(feed?.jobs) ? feed.jobs : [];
  if (!jobs.length) return NextResponse.json({ error: 'feed.jobs[] required' }, { status: 400 });
  const day = String(feed.generated_at || new Date().toISOString()).slice(0, 10);
  await sql`update feed set is_new = false`;
  let n = 0;
  for (const j of jobs) {
    const id = String(j.id || ''); if (!id) continue; n++;
    await sql`insert into feed (id, company, title, location, url, posted, source, provider, tier, first_seen, last_seen, is_new, data)
      values (${id}, ${String(j.company || '')}, ${String(j.title || '')}, ${String(j.location || '')}, ${String(j.url || '')}, ${String(j.posted || '')}, ${String(j.source || '')}, ${String(j.provider || '')}, ${Number(j.tier) || 3}, ${String(j.first_seen || day)}::date, ${day}::date, ${!!j.new}, ${JSON.stringify(j)}::jsonb)
      on conflict (id) do update set title = excluded.title, location = excluded.location, url = excluded.url, posted = excluded.posted, tier = excluded.tier, last_seen = excluded.last_seen, is_new = excluded.is_new, data = excluded.data`;
  }
  await sql`insert into events (kind, detail, actor) values ('feed.ingested', ${JSON.stringify({ day, count: n, counts: feed.counts || null, errors: feed.errors || [] })}::jsonb, 'action')`;
  return NextResponse.json({ ok: true, count: n, day });
  });
}
