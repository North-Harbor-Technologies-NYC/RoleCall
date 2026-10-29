import Link from 'next/link';
import { listFeed } from '@/lib/queries';
import { toneOf, scoreNum, mmdd, locationShort } from '@/lib/present';
import DbNotice from '@/components/DbNotice';

export const dynamic = 'force-dynamic';

export default async function FeedPage({ searchParams }: { searchParams: Promise<{ all?: string; tier?: string; q?: string }> }) {
  const sp = await searchParams;
  const newOnly = sp.all !== '1';
  const tier = sp.tier && ['1', '2', '3'].includes(sp.tier) ? Number(sp.tier) : null;
  const q = (sp.q || '').trim();
  let rows: Record<string, unknown>[] = [], meta: Record<string, unknown> = {}, err: string | null = null;
  try { const r = await listFeed({ newOnly, tier, q }); rows = r.rows as Record<string, unknown>[]; meta = (r.meta || {}) as Record<string, unknown>; } catch (e) { err = String((e as Error).message || e); }
  const link = (o: Record<string, string | undefined>) => { const p = new URLSearchParams(); const m = { all: newOnly ? undefined : '1', tier: tier ? String(tier) : undefined, q: q || undefined, ...o }; for (const [k, v] of Object.entries(m)) if (v) p.set(k, v); return `/feed${p.toString() ? `?${p}` : ''}`; };
  const total = Number(meta.total || 0), fresh = Number(meta.fresh || 0);
  return (
    <main className="main">
      {err && <DbNotice error={err} />}
      <div className="pagehead">
        <div>
          <h1>Feed</h1>
          <p>Every posting that passed the title filter and hard blockers, before scoring. {meta.day ? <>Last scan {String(meta.day).slice(0, 10)}: {total.toLocaleString('en-US')} postings, <span className="tone-fit" style={{ fontWeight: 500 }}>{fresh} new</span>.</> : 'No feed ingested yet.'}</p>
        </div>
        <form action="/feed">{!newOnly && <input type="hidden" name="all" value="1" />}{tier && <input type="hidden" name="tier" value={tier} />}<input className="search" name="q" defaultValue={q} placeholder="Search company or title" aria-label="Search company or title" /></form>
      </div>
      <div className="segs-row">
        <div className="seg" role="group" aria-label="Scope">
          <Link href={link({ all: undefined })} className={newOnly ? 'active' : ''}>New since last scan</Link>
          <Link href={link({ all: '1' })} className={!newOnly ? 'active' : ''}>All in feed</Link>
        </div>
        <div className="seg" role="group" aria-label="Tier">
          {[null, 1, 2, 3].map(t => <Link key={String(t)} href={link({ tier: t ? String(t) : undefined })} className={tier === t ? 'active' : ''}>{t ? `Tier ${t}` : 'Any tier'}</Link>)}
        </div>
      </div>
      {rows.length === 0 && !err && <div className="empty"><b>Nothing matches</b><span>Try the other scope or another tier.</span></div>}
      {rows.length > 0 && (
        <div className="list cols-feed">
          <div className="hrow"><span>Role</span><span>Location</span><span>Tier</span><span>Seen</span><span className="right">Score</span></div>
          {rows.map(r => {
            const s = scoreNum(r.job_score as string | null); const tone = toneOf(r.job_score as string | null);
            return (
              <div className="row" key={String(r.id)}>
                <span><div className="role withdot"><span className={`dotnew ${r.is_new ? '' : 'off'}`} aria-hidden="true" /><a href={String(r.url)} target="_blank" rel="noreferrer">{String(r.title)}</a></div><div className="co" style={{ paddingLeft: 17 }}>{String(r.company)}</div></span>
                <span className="cell">{locationShort(String(r.location || ''))}</span>
                <span className="num">T{String(r.tier)}</span>
                <span className="num">{mmdd(String(r.first_seen || ''))}</span>
                <span className="right">{r.job_id ? <Link href={`/jobs/${encodeURIComponent(String(r.job_id))}`} className={`tone-${tone === 'neutral' ? 'mute' : tone}`} style={{ font: '600 16px/1 var(--rc-font)', textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>{s === null ? String(r.job_status) : s.toFixed(1)}</Link> : <span className="tone-dim">–</span>}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
