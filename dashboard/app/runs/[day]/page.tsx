import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getRun, jobsForDay } from '@/lib/queries';
import { fmtDay, scoreNum, sourceLabel } from '@/lib/present';
import Score from '@/components/Score';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) notFound();
  const run = await getRun(day) as Record<string, unknown> | null;
  if (!run) notFound();
  const d = (run.digest || {}) as Record<string, unknown>;
  const s = (run.summary || {}) as Record<string, Record<string, unknown>>;
  const list = (k: string) => (Array.isArray(d[k]) ? (d[k] as Record<string, unknown>[]) : []);
  const jobs = await jobsForDay(day);
  const kept = jobs.filter(j => Number(j.score) >= 3.5 && j.status !== 'SKIP');
  const skipped = jobs.filter(j => j.status === 'SKIP' || (scoreNum(j.score) !== null && Number(j.score) < 3.5));
  const threads = Number((s.window as Record<string, unknown> | undefined)?.threads_in_window ?? (s.gmail as Record<string, unknown[]> | undefined)?.threads?.length ?? 0);
  const boards = Number(((s.feed as Record<string, Record<string, unknown>>)?.counts?.sources) ?? 0);
  const scored = Number((s.evaluate as Record<string, unknown> | undefined)?.scored ?? jobs.length);
  const keptN = Number((s.evaluate as Record<string, unknown> | undefined)?.at_or_above_4 ?? 0) + Number((s.evaluate as Record<string, unknown> | undefined)?.optional ?? 0);
  const failures = list('failures'); const cnv = list('could_not_verify'); const system = list('system');
  const keptList = kept.length ? kept.map(j => ({ company: j.company, role: j.role, score: j.score, source: j.source, id: j.id })) : [...list('top'), ...list('optional')].map(r => ({ company: String(r.company), role: String(r.role), score: r.score as number, source: String(r.source || ''), id: null as string | null }));
  const maxSkip = Math.max(1, ...skipped.map(j => Number(j.score) || 0));
  return (
    <>
      <main className="main main-narrow">
        <Link href="/runs" className="back"><span aria-hidden="true">←</span> Runs</Link>
        <h1 className="greet" style={{ marginTop: 16 }}>{fmtDay(day)}</h1>
        {d.headline ? <p className="headline">{String(d.headline)}</p> : null}
        {failures.length > 0 && (
          <div className="notice notice-needs" role="alert" style={{ marginTop: 20 }}><b>{failures.length} {failures.length === 1 ? 'failure' : 'failures'}.</b> {failures.map((f, i) => <span key={i}>{String(f)} </span>)}</div>
        )}
        <div className="stats">
          <div><b>{threads}</b><span>Inbox threads</span></div>
          <div><b>{boards}</b><span>Boards checked</span></div>
          <div><b>{scored}</b><span>Roles scored</span></div>
          <div><b className={keptN > 0 ? 'tone-fit' : ''}>{keptN}</b><span>Kept</span></div>
        </div>

        <div className="section"><h2>Kept</h2><Link href="/" style={{ font: '500 14px/20px var(--rc-font)' }}>Open in Today</Link></div>
        {keptList.length === 0 && <p className="foot-line">Nothing at 3.5 or above.</p>}
        <div className="rows">
          {keptList.map((r, i) => (
            <div className="r" key={i}>
              <div><h3>{r.id ? <Link href={`/jobs/${encodeURIComponent(r.id)}`}>{r.role}</Link> : r.role}</h3><div className="meta">{r.company}{r.source ? ` · ${sourceLabel(String(r.source))}` : ''}</div></div>
              <Score value={r.score} size="sm" />
            </div>
          ))}
        </div>

        {cnv.length > 0 && (
          <>
            <div className="section"><h2>Could not verify</h2><span className="tone-mute">{cnv.length}</span></div>
            <div className="rows">
              {cnv.map((r, i) => (
                <div className="r" key={i}>
                  <div><h3>{String(r.company)} · {String(r.role)}</h3>{r.tried ? <div className="tried">{String(r.tried)}</div> : null}</div>
                  <span className="chip chip-neutral">{String(r.resolution || 'unresolved').replace(/^\w/, c => c.toUpperCase())}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {run.summary ? <details className="raw"><summary>Show raw summary JSON</summary><pre className="raw">{JSON.stringify(run.summary, null, 1)}</pre></details> : null}
      </main>
      <aside className="rail">
        {skipped.length > 0 && (
          <div className="railcard">
            <div className="title">Why {skipped.length} {skipped.length === 1 ? 'was' : 'were'} skipped</div>
            {skipped.slice(0, 12).map(j => (
              <div className="item" key={j.id}>
                <div className="h"><b>{j.company} · {j.role}</b><span className="n">{scoreNum(j.score)?.toFixed(1) ?? ''}</span></div>
                {j.reason ? <span>{j.reason}</span> : null}
                <div className="bar" aria-hidden="true"><i style={{ width: `${Math.round(((Number(j.score) || 0) / maxSkip) * 100)}%` }} /></div>
              </div>
            ))}
            {skipped.length > 12 && <p>and {skipped.length - 12} more below the bar.</p>}
          </div>
        )}
        {system.length > 0 && (
          <div className="railcard">
            <div className="title">System notes</div>
            {system.map((t, i) => <p key={i} style={{ marginTop: i === 0 ? 0 : 10 }}>{String(t)}</p>)}
          </div>
        )}
      </aside>
    </>
  );
}
