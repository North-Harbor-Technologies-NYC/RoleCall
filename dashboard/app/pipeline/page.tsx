import Link from 'next/link';
import { listPipeline, pipelineCounts, needs, PIPELINE_FILTERS, type PipelineFilter } from '@/lib/queries';
import { STATUS_TONE, isoDay, fmtDay } from '@/lib/present';
import JobActions from '@/components/JobActions';
import DbNotice from '@/components/DbNotice';
import type { Job } from '@/lib/db';

export const dynamic = 'force-dynamic';

function nextStep(j: Job): { text: string; tone?: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (j.status === 'Applied' && !j.applied_date) return { text: 'Add a date to start' };
  if (['Applied', 'Responded', 'Interview'].includes(j.status) && j.next_followup) {
    const d = isoDay(j.next_followup);
    return d <= today ? { text: `Follow up, due ${fmtDay(d, { month: 'short', day: 'numeric' })}`, tone: 'needs' } : { text: `Follow up ${fmtDay(d, { month: 'short', day: 'numeric' })}` };
  }
  if (j.status === 'Evaluated' && j.action === 'Apply') return { text: j.resume_review ? 'Submit, then mark applied' : 'Resume on the next run' };
  if (j.status === 'Evaluated' && j.action === 'Hold') return { text: 'Decide when ready' };
  if (j.status === 'Interview') return { text: 'Prep in the report' };
  if (j.status === 'Offer') return { text: 'Negotiate' };
  return { text: '' };
}

export default async function Pipeline({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const sp = await searchParams;
  const filter = (PIPELINE_FILTERS.some(f => f.key === sp.status) ? sp.status : 'queue') as PipelineFilter;
  const q = (sp.q || '').trim();
  let jobs: Job[] = [], counts: Record<string, number> = {}, n: Awaited<ReturnType<typeof needs>> | null = null, dbError: string | null = null;
  try { [jobs, counts, n] = await Promise.all([listPipeline(filter, q), pipelineCounts(), needs()]); } catch (e) { dbError = String((e as Error).message || e); }
  const link = (f: PipelineFilter) => `/pipeline?status=${f}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  const dotVar: Record<string, string> = { fit: 'var(--rc-fit)', progress: 'var(--rc-progress)', responded: 'var(--rc-responded)', interview: 'var(--rc-interview)', neutral: 'var(--rc-dim)', ink: 'var(--rc-ink)' };
  return (
    <main className="main">
      {dbError && <DbNotice error={dbError} />}
      <div className="pagehead">
        <div><h1>Pipeline</h1><p>Everything you have acted on, newest touch first.</p></div>
        <form action="/pipeline"><input type="hidden" name="status" value={filter} /><input className="search" name="q" defaultValue={q} placeholder="Search company or role" aria-label="Search company or role" /></form>
      </div>
      <div className="filters">
        {PIPELINE_FILTERS.map(f => (
          <Link key={f.key} href={link(f.key)} className={`fchip ${filter === f.key ? 'active' : ''}`}>
            <span className="dot" style={{ background: filter === f.key && f.tone === 'ink' ? 'var(--rc-paper)' : dotVar[f.tone] }} />{f.label}<span className="n">{counts[f.key] ?? ''}</span>
          </Link>
        ))}
      </div>
      {n && n.noDate > 0 && filter === 'applied' && (
        <div className="needs needs-inline" style={{ marginBottom: 16 }}>
          <div className="body"><b className="tone-needs">{n.noDate} {n.noDate === 1 ? 'application has' : 'applications have'} no applied date.</b> Follow-up reminders start once each row has one.</div>
        </div>
      )}
      {jobs.length === 0 && !dbError && <div className="empty"><b>Nothing here{q ? ' for that search' : ''}</b><span>{filter === 'queue' ? 'Decide on roles from Today and they land here.' : ''}</span></div>}
      {jobs.length > 0 && (
        <div className="list cols-pipeline">
          <div className="hrow"><span>Status</span><span>Role</span><span>Applied</span><span>Next</span><span className="right"></span></div>
          {jobs.map(j => {
            const step = nextStep(j);
            const chip = j.status === 'Evaluated' && j.action ? { label: j.action, tone: j.action === 'Apply' ? 'fit' : j.action === 'Hold' ? 'watch' : 'neutral' } : { label: j.status === 'SKIP' ? 'Skipped' : j.status, tone: STATUS_TONE[j.status] || 'neutral' };
            return (
              <div className="row" key={j.id}>
                <span><span className={`chip chip-${chip.tone}`}>{chip.label}</span></span>
                <span><div className="role"><Link href={`/jobs/${encodeURIComponent(j.id)}`}>{j.role}</Link></div><div className="co">{j.company}</div></span>
                <span className={`num ${j.status === 'Applied' && !j.applied_date ? 'tone-needs' : ''}`}>{j.applied_date ? isoDay(j.applied_date) : j.status === 'Applied' ? 'No date' : ''}</span>
                <span className={`cell ${step.tone ? `tone-${step.tone}` : ''}`}>{step.text}</span>
                <span className="right"><JobActions id={j.id} action={j.action} status={j.status} hasResume={!!j.resume_review} appliedDate={j.applied_date ? isoDay(j.applied_date) : null} compact /></span>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
