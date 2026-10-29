import Link from 'next/link';
import { auth } from '@/auth';
import { todayQueue, decidedToday, needs, latestRun, jobsForDay } from '@/lib/queries';
import { fitWatch, checksOf, metaLine, toneOf, scoreNum, reportLink, numberWord, greetingWord, firstName, RUN_TIME_LABEL, isoDay, STAGE_VAR } from '@/lib/present';
import TriageQueue, { type TriageJob } from '@/components/TriageQueue';
import DbNotice from '@/components/DbNotice';

export const dynamic = 'force-dynamic';

// Color "N recommended" (fit) and "N optional" (watch) inside the routine's headline, nothing else.
function Headline({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  const re = /\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|no)\s+(?:recommended(?:\s+appl(?:y|ies))?|optional(?:\s+roles?)?))\b/gi;
  let last = 0; let m: RegExpExecArray | null; let k = 0;
  while ((m = re.exec(text))) {
    parts.push(text.slice(last, m.index));
    parts.push(<span key={k++} className={/recommended/i.test(m[1]) ? 'hl-fit' : 'hl-watch'}>{m[1]}</span>);
    last = m.index + m[1].length;
  }
  parts.push(text.slice(last));
  return <p className="headline">{parts}</p>;
}

export default async function Today() {
  const session = await auth();
  let queue: TriageJob[] = [], decided = 0, n: Awaited<ReturnType<typeof needs>> | null = null, run: Record<string, unknown> | null = null, dayJobs = 0, dbError: string | null = null;
  try {
    const [q, d, nd, r] = await Promise.all([todayQueue(), decidedToday(), needs(), latestRun()]);
    queue = q.map(j => { const fw = fitWatch(j); return { id: j.id, role: j.role, company: j.company, meta: metaLine(j), score: scoreNum(j.score), tone: toneOf(j.score), fit: fw.fit, watch: fw.watch, checks: checksOf(j), report: reportLink(j.report, j.date_found), url: j.url }; });
    decided = d.length; n = nd; run = (r as Record<string, unknown>) || null;
    if (run?.run_date) dayJobs = (await jobsForDay(isoDay(String(run.run_date)))).filter(j => j.status === 'SKIP').length;
  } catch (e) { dbError = String((e as Error).message || e); }

  const digest = (run?.digest || {}) as Record<string, unknown>;
  const summary = (run?.summary || {}) as Record<string, Record<string, unknown>>;
  const count = queue.length;
  const name = firstName(session);
  const greet = `${greetingWord()}, ${name}. ${count === 0 ? 'Nothing' : numberWord(count).replace(/^\w/, c => c.toUpperCase())} ${count === 1 ? 'role' : 'roles'} to decide on.`;
  const due = n?.due || 0, noDate = n?.noDate || 0, stale = n?.stale || 0;
  const stages = ['Applied', 'Responded', 'Interview', 'Offer'].map(k => ({ k, v: n?.stages?.[k] || 0 }));
  const max = Math.max(1, ...stages.map(s => s.v));
  const feed = (summary.feed as Record<string, Record<string, unknown>> | undefined)?.counts || {};
  const threads = Number((summary.window as Record<string, unknown> | undefined)?.threads_in_window ?? (summary.gmail as Record<string, unknown[]> | undefined)?.threads?.length ?? 0);
  const scored = Number((summary.evaluate as Record<string, unknown> | undefined)?.scored ?? 0);
  const kept = Number((summary.evaluate as Record<string, unknown> | undefined)?.at_or_above_4 ?? 0) + Number((summary.evaluate as Record<string, unknown> | undefined)?.optional ?? 0);
  const failures = Array.isArray(digest.failures) ? (digest.failures as unknown[]).length : 0;
  const cnv = Array.isArray(digest.could_not_verify) ? (digest.could_not_verify as unknown[]).length : 0;
  const runDay = run?.run_date ? isoDay(String(run.run_date)) : '';

  return (
    <>
      <main className="main main-narrow">
        {dbError && <DbNotice error={dbError} />}
        <h1 className="greet">{greet}</h1>
        {digest.headline ? <Headline text={String(digest.headline)} /> : null}
        <TriageQueue initial={queue} decidedBefore={decided} runTime={RUN_TIME_LABEL} />
        {runDay && (cnv > 0 || dayJobs > 0) && (
          <p className="foot-line">{cnv > 0 ? `${cnv} ${cnv === 1 ? 'role' : 'roles'} could not be verified` : ''}{cnv > 0 && dayJobs > 0 ? ' and ' : ''}{dayJobs > 0 ? `${dayJobs} ${cnv === 0 ? (dayJobs === 1 ? 'role was' : 'roles were') : 'were'} below your bar` : ''}. <Link href={`/runs/${runDay}`}>See what was filtered</Link></p>
        )}
      </main>
      <aside className="rail">
        {(due > 0 || noDate > 0 || stale > 0) && (
          <div className="needs">
            <div className="eyebrow">Needs you</div>
            {due > 0 ? (
              <>
                <div className="title">{due} {due === 1 ? 'follow-up is' : 'follow-ups are'} due</div>
                <div className="body">Applications past their follow-up date. Reach out, then mark the touch so the next reminder is right.</div>
                <Link className="btn btn-needs btn-sm" href="/pipeline?status=applied">See follow-ups</Link>
              </>
            ) : noDate > 0 ? (
              <>
                <div className="title">{noDate} {noDate === 1 ? 'application needs a date' : 'applications need dates'}</div>
                <div className="body">They came from the Drive backfill. Add applied dates and RoleCall will tell you when to follow up.</div>
                <Link className="btn btn-needs btn-sm" href="/pipeline?status=applied">Add dates</Link>
              </>
            ) : (
              <>
                <div className="title">{stale} {stale === 1 ? 'application has' : 'applications have'} gone quiet</div>
                <div className="body">Applied over three weeks ago with no touch since. Follow up or close them out.</div>
                <Link className="btn btn-needs btn-sm" href="/pipeline?status=applied">See them</Link>
              </>
            )}
          </div>
        )}
        <div className="meter">
          <div className="title">Your search</div>
          {stages.map(s => (
            <div key={s.k}>
              <div className="row"><span className="dot" style={{ background: STAGE_VAR[s.k] }} /><span className="lab">{s.k}</span><span className="n">{s.v}</span></div>
              <div className="bar"><i style={{ width: `${Math.round((s.v / max) * 100)}%`, background: STAGE_VAR[s.k] }} /></div>
            </div>
          ))}
        </div>
        {run && (
          <p className="runlog">
            {greetingWord() === 'Morning' ? "This morning's" : "Today's"} run read {threads} inbox {threads === 1 ? 'thread' : 'threads'} and {Number(feed.sources || 0)} boards, scored {scored} {scored === 1 ? 'role' : 'roles'}, and kept {kept}.{' '}
            {failures > 0 ? <Link href={`/runs/${runDay}`} className="tone-needs">{failures} {failures === 1 ? 'error' : 'errors'}</Link> : 'No errors.'}
          </p>
        )}
      </aside>
    </>
  );
}
