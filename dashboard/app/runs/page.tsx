import Link from 'next/link';
import { listRuns } from '@/lib/queries';
import { isoDay, fmtDay, minutesBetween, RUN_TIME_LABEL } from '@/lib/present';
import DbNotice from '@/components/DbNotice';

export const dynamic = 'force-dynamic';

type Run = { run_date: string; started_at: string | null; finished_at: string | null; summary: Record<string, Record<string, unknown>> | null; has_digest: boolean };

export default async function RunsPage() {
  let runs: Run[] = [], err: string | null = null;
  try { runs = (await listRuns()) as unknown as Run[]; } catch (e) { err = String((e as Error).message || e); }
  return (
    <main className="main">
      {err && <DbNotice error={err} />}
      <div className="pagehead"><div><h1>Runs</h1><p>One per day at {RUN_TIME_LABEL}.</p></div></div>
      {runs.length === 0 && !err && <div className="empty"><b>No runs yet</b><span>The routine posts one record per day once it is pointed at this dashboard.</span></div>}
      {runs.length > 0 && (
        <div className="list cols-runs">
          <div className="hrow"><span>Date</span><span>Scored, and what was kept</span><span>New in feed</span><span>Duration</span><span className="right">Status</span></div>
          {runs.map(r => {
            const s = r.summary || {};
            const ev = (s.evaluate || {}) as Record<string, unknown>;
            const scored = Number(ev.scored ?? 0), kept = Number(ev.at_or_above_4 ?? 0), maybe = Number(ev.optional ?? 0);
            const feedNew = Number(((s.feed as Record<string, Record<string, unknown>>)?.counts?.new) ?? (s.feed as Record<string, unknown>)?.new ?? 0);
            const fails = (s as Record<string, unknown>).failures;
            const failed = Number(((s.feed as Record<string, Record<string, unknown>>)?.counts?.failed) ?? 0) + (Array.isArray(fails) ? fails.length : 0);
            const mins = minutesBetween(r.started_at, r.finished_at);
            const day = isoDay(r.run_date);
            const pct = (n: number) => scored ? `${Math.round((n / scored) * 100)}%` : '0%';
            return (
              <div className="row" key={day}>
                <span><div className="role"><Link href={`/runs/${day}`}>{fmtDay(day, { weekday: 'short' })}</Link></div><div className="num">{day}</div></span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <span className="stack" aria-hidden="true"><i className="fit" style={{ width: pct(kept) }} /><i className="watch" style={{ width: pct(maybe) }} /></span>
                  <span className="cell"><b>{scored}</b> scored · <b className="tone-fit">{kept} kept</b> · <b className="tone-watch">{maybe} maybe</b></span>
                </span>
                <span className="num">{feedNew}</span>
                <span className="num">{mins === null ? '' : `${mins} min`}</span>
                <span className="right">{failed > 0 ? <span className="chip chip-needs">{failed} failed</span> : <span className="chip chip-fit">OK</span>}</span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
