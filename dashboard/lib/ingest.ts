// Bearer-token check for routes the routine and the GitHub Action call, plus an error wrapper that reports
// database failures as JSON instead of a bare 500, so a misconfigured DATABASE_URL is visible from curl.
import { NextResponse } from 'next/server';
import { dbSource } from '@/lib/db';

export function checkIngest(req: Request): NextResponse | null {
  const token = process.env.INGEST_TOKEN;
  if (!token) return NextResponse.json({ error: 'INGEST_TOKEN is not configured' }, { status: 503 });
  const got = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!got || got !== token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return null;
}

export async function guarded(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try { return await fn(); }
  catch (e) {
    const msg = String((e as Error)?.message || e);
    const names = Object.keys(process.env).filter(n => /(DATABASE|POSTGRES|PG|NEON)/i.test(n)).sort();
    const hint = dbSource ? `using ${dbSource.name}` : `no postgres:// URL found in the environment; database-looking variables present: ${names.join(', ') || 'none'}`;
    return NextResponse.json({ error: msg, hint }, { status: 500 });
  }
}
