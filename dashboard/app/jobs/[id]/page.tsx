import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getJob, recentEvents, contactsFor } from '@/lib/queries';
import { fitWatch, checksOf, metaLine, toneOf, reportLink, isoDay, STATUS_TONE, sourceLabel } from '@/lib/present';
import Score from '@/components/Score';
import JobActions from '@/components/JobActions';
import NotesForm from '@/components/NotesForm';

export const dynamic = 'force-dynamic';

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(decodeURIComponent(id));
  if (!job) notFound();
  const [events, contacts] = await Promise.all([recentEvents(job.id), contactsFor(job.id)]);
  const report = reportLink(job.report, job.date_found);
  const flags = Array.isArray(job.flags) ? (job.flags as string[]) : [];
  const fw = fitWatch(job); const checks = checksOf(job); const tone = toneOf(job.score);
  const chip = job.status === 'Evaluated' && job.action ? { label: job.action, tone: job.action === 'Apply' ? 'fit' : job.action === 'Hold' ? 'watch' : 'neutral' } : { label: job.status === 'SKIP' ? 'Skipped' : job.status, tone: STATUS_TONE[job.status] || 'neutral' };
  return (
    <main className="main main-narrow detail">
      <Link href="/" className="back"><span aria-hidden="true">←</span> Today</Link>
      <article className={`match match-${tone === 'fit' ? 'fit' : 'watch'}`} style={{ marginTop: 16, borderTopColor: tone === 'neutral' || tone === 'none' ? 'var(--rc-line-strong)' : undefined }}>
        <div className="head">
          <div className="hrow">
            <span><span className={`chip chip-${chip.tone}`}>{chip.label}</span><span className="tone-dim mono" style={{ marginLeft: 10 }}>{isoDay(job.date_found)}{job.source ? ` · ${sourceLabel(job.source)}` : ''}</span></span>
            <Score value={job.score} size="lg" />
          </div>
          <h2>{job.role}</h2>
          <div className="meta">{metaLine(job)}</div>
        </div>
        {(fw.fit || fw.watch) && (
          <div className="panels">
            {fw.fit && <div className="panel panel-fit"><div className="lab">Why it fits</div>{fw.fit}</div>}
            {fw.watch && <div className="panel panel-watch"><div className="lab">Worth knowing</div>{fw.watch}</div>}
          </div>
        )}
        {checks && checks.length > 0 && (
          <div className="checks">
            <div className="lab">Before you apply<span className={checks.some(c => !c.done) ? '' : 'all'}>{checks.filter(c => !c.done).length ? `${checks.filter(c => !c.done).length} open` : 'All checked'}</span></div>
            {checks.map((c, i) => <div key={i} className={`check ${c.done ? 'done' : ''}`}><span className="box" aria-hidden="true" /><span className="text">{c.text}</span></div>)}
          </div>
        )}
        <div className="acts always">
          <JobActions id={job.id} action={job.action} status={job.status} hasResume={!!job.resume_review} appliedDate={job.applied_date ? isoDay(job.applied_date) : null} />
          <span className="spacer" />
          {job.url && <a className="btn btn-secondary btn-sm" href={job.url} target="_blank" rel="noreferrer">Open posting</a>}
          {report && <a className="btn btn-ghost btn-sm" href={report} target="_blank" rel="noreferrer">Report</a>}
          {job.resume_review && <a className="btn btn-ghost btn-sm" href={job.resume_review} target="_blank" rel="noreferrer">Resume, review copy</a>}
          {job.resume_submit && <a className="btn btn-ghost btn-sm" href={/^https?:/.test(job.resume_submit) ? job.resume_submit : reportLink(job.resume_submit, job.date_found) || '#'} target="_blank" rel="noreferrer">Resume, submit copy</a>}
        </div>
      </article>

      <div className="card">
        <h2>Details</h2>
        <dl className="kv">
          <dt>Archetype</dt><dd>{job.archetype || 'not set'}</dd>
          <dt>Legitimacy</dt><dd>{job.legitimacy || 'not assessed'}</dd>
          <dt>Resolution</dt><dd>{job.resolution || ''}</dd>
          <dt>Tier</dt><dd>{job.tier ?? ''}</dd>
          <dt>Flags</dt><dd>{flags.length ? flags.join(', ') : 'none'}</dd>
          <dt>Applied</dt><dd>{isoDay(job.applied_date)}</dd>
          <dt>Last touch</dt><dd>{isoDay(job.last_touch)}</dd>
          <dt>Next follow-up</dt><dd>{isoDay(job.next_followup)}</dd>
          <dt>Contact</dt><dd>{job.contact || ''}</dd>
          {job.alert_url && <><dt>Alert link</dt><dd><a href={job.alert_url} target="_blank" rel="noreferrer">{new URL(job.alert_url).hostname}</a></dd></>}
          <dt>Id</dt><dd className="tone-dim mono">{job.id}</dd>
        </dl>
      </div>
      {job.score_breakdown && <div className="card"><h2>Score breakdown</h2><pre className="jd">{job.score_breakdown}</pre></div>}

      <div className="card" id="dates">
        <h2>Notes and dates</h2>
        <NotesForm id={job.id} notes={job.notes || ''} contact={job.contact || ''} appliedDate={isoDay(job.applied_date)} nextFollowup={isoDay(job.next_followup)} />
      </div>

      {contacts.length > 0 && (
        <div className="card">
          <h2>Outreach</h2>
          {contacts.map((c: Record<string, unknown>) => (
            <div key={String(c.id)} style={{ marginBottom: 14 }}>
              <b>{String(c.name || '')}</b> <span className="tone-mute">{String(c.title || '')} · {String(c.channel || '')}</span>{c.url ? <> · <a href={String(c.url)} target="_blank" rel="noreferrer">profile</a></> : null}
              {c.draft ? <pre className="jd" style={{ marginTop: 8 }}>{String(c.draft)}</pre> : null}
            </div>
          ))}
        </div>
      )}

      {job.jd && <div className="card"><h2>Job description, as captured</h2><pre className="jd">{job.jd}</pre></div>}

      <div className="card">
        <h2>History</h2>
        <div className="hist">{events.map((e: Record<string, unknown>, i: number) => (
          <div key={i}><span>{new Date(String(e.created_at)).toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })}</span><span>{String(e.kind)}</span><span>{String(e.actor || '')}{e.detail ? ` · ${JSON.stringify(e.detail)}` : ''}</span></div>
        ))}</div>
      </div>
    </main>
  );
}
