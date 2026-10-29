'use client';
// Today's decisions. Holds the undecided queue locally, acts with optimistic updates, and offers Undo on every change.
// Keys: J/K move, A apply, H hold, S skip, Enter open, X toggle the first open checklist item. Ignored while typing.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Score from '@/components/Score';
import type { Check } from '@/lib/present';

export type TriageJob = {
  id: string; role: string; company: string; meta: string; score: number | null; tone: 'fit' | 'watch' | 'neutral' | 'none';
  fit: string; watch: string; checks: Check[] | null; report: string | null; url: string | null;
};
type Toast = { text: string; undo?: () => Promise<void> } | null;
type Props = { initial: TriageJob[]; decidedBefore: number; runTime: string };

const api = (id: string) => `/api/jobs/${encodeURIComponent(id)}`;

export default function TriageQueue({ initial, decidedBefore, runTime }: Props) {
  const router = useRouter();
  const [queue, setQueue] = useState<TriageJob[]>(initial);
  const [decided, setDecided] = useState(decidedBefore);
  const [focus, setFocus] = useState(0);
  const [toast, setToast] = useState<Toast>(null);
  const [busy, setBusy] = useState<string | null>(null); // "build" while a resume build is pending
  const [mobile, setMobile] = useState(false);
  const [checksOpen, setChecksOpen] = useState(false);
  const [keyed, setKeyed] = useState(false); // the focus ring shows only once the keyboard has been used
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = decided + queue.length;

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 599px)');
    const set = () => setMobile(mq.matches); set();
    mq.addEventListener('change', set); return () => mq.removeEventListener('change', set);
  }, []);

  const show = useCallback((t: Toast) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(t);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  async function patch(id: string, body: Record<string, unknown>) {
    const res = await fetch(api(id), { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
    return res.json();
  }

  // Remove a role from the queue with an undo that puts it back where it was.
  async function decide(job: TriageJob, label: string, apply: () => Promise<void>, revert: () => Promise<void>) {
    const at = queue.findIndex(j => j.id === job.id);
    setQueue(q => q.filter(j => j.id !== job.id));
    setDecided(d => d + 1);
    setFocus(f => Math.max(0, Math.min(f, queue.length - 2)));
    try { await apply(); } catch (e) {
      setQueue(q => { const n = [...q]; n.splice(at, 0, job); return n; }); setDecided(d => d - 1);
      show({ text: `Could not save: ${(e as Error).message}` }); return;
    }
    router.refresh();
    show({ text: label, undo: async () => {
      try { await revert(); } catch (e) { show({ text: `Undo failed: ${(e as Error).message}` }); return; }
      setQueue(q => { const n = [...q]; n.splice(Math.min(at, n.length), 0, job); return n; }); setDecided(d => d - 1); setToast(null); router.refresh();
    } });
  }
  const hold = (job: TriageJob) => decide(job, `Held ${job.company}.`, () => patch(job.id, { action: 'Hold' }), () => patch(job.id, { action: '' }));
  const skip = (job: TriageJob) => decide(job, `Skipped ${job.company}.`, () => patch(job.id, { action: 'Skip' }), () => patch(job.id, { action: '' }));
  async function apply(job: TriageJob) {
    setBusy(job.id);
    let text = 'Marked Apply. Resume lands in a few minutes.';
    await decide(job, text, async () => {
      const res = await fetch(`${api(job.id)}/build-resume`, { method: 'POST' });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error?.error || b.error || `HTTP ${res.status}`);
      text = b.fired ? 'Marked Apply. Resume lands in a few minutes.' : 'Marked Apply. The next run builds the resume.';
    }, () => patch(job.id, { action: '' }));
    setBusy(null);
    setToast(t => (t && t.text.startsWith('Marked Apply') ? { ...t, text } : t));
  }
  async function toggleCheck(job: TriageJob, i: number) {
    if (!job.checks) return;
    const next = job.checks.map((c, k) => (k === i ? { ...c, done: !c.done } : c));
    setQueue(q => q.map(j => (j.id === job.id ? { ...j, checks: next } : j)));
    try { await patch(job.id, { checks: next }); } catch (e) { show({ text: `Could not save the checklist: ${(e as Error).message}` }); }
  }

  // Keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const job = queue[focus]; const k = e.key.toLowerCase();
      if (k === 'j') { e.preventDefault(); setKeyed(true); setFocus(f => Math.min(queue.length - 1, f + 1)); }
      else if (k === 'k') { e.preventDefault(); setKeyed(true); setFocus(f => Math.max(0, f - 1)); }
      else if (!job) return;
      else if (k === 'a') { e.preventDefault(); if (!busy) void apply(job); }
      else if (k === 'h') { e.preventDefault(); void hold(job); }
      else if (k === 's') { e.preventDefault(); void skip(job); }
      else if (k === 'enter') { e.preventDefault(); router.push(`/jobs/${encodeURIComponent(job.id)}`); }
      else if (k === 'x') { e.preventDefault(); const i = (job.checks || []).findIndex(c => !c.done); if (i >= 0) void toggleCheck(job, i); }
    }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  });

  const lead = queue[0];
  const rest = queue.slice(1);
  const allWatch = useMemo(() => rest.every(j => j.tone !== 'fit'), [rest]);
  const open = lead?.checks ? lead.checks.filter(c => !c.done).length : 0;

  return (
    <div className={mobile && lead ? 'has-mbar' : ''}>
      {total > 0 && (
        <div className="progress" role="img" aria-label={`${decided} of ${total} decided`}>
          <div className="segs">
            {Array.from({ length: decided }, (_, i) => <i key={`d${i}`} className="fit done" />)}
            {queue.map(j => <i key={j.id} className={j.tone === 'fit' ? 'fit' : 'watch'} />)}
          </div>
          <div className="label">{decided} of {total} decided</div>
        </div>
      )}

      {!lead && (
        <div className="empty" style={{ marginTop: total > 0 ? 0 : 28 }}>
          <b>All caught up</b>
          <span>The next run is tomorrow at {runTime}.</span>
        </div>
      )}

      {lead && (
        <article key={lead.id} className={`match match-${lead.tone === 'fit' ? 'fit' : 'watch'} slide-in ${keyed && focus === 0 ? 'focused' : ''}`} aria-current={keyed && focus === 0 ? 'true' : undefined}>
          <div className="head">
            <div className="hrow">
              <span><span className="idx">01</span><span className={`chip ${lead.tone === 'fit' ? 'chip-fit' : 'chip-watch'}`}>{lead.tone === 'fit' ? 'Strong match' : 'Maybe'}</span></span>
              <Score value={lead.score} size="lg" />
            </div>
            <h2><Link href={`/jobs/${encodeURIComponent(lead.id)}`}>{lead.role}</Link></h2>
            <div className="meta">{lead.meta}</div>
          </div>
          {(lead.fit || lead.watch) && (
            <div className="panels">
              {lead.fit && <div className="panel panel-fit"><div className="lab">Why it fits</div>{lead.fit}</div>}
              {lead.watch && <div className="panel panel-watch"><div className="lab">Worth knowing</div>{lead.watch}</div>}
            </div>
          )}
          {lead.checks && lead.checks.length > 0 && (
            <div className="checks">
              {mobile ? (
                <button type="button" className="lab" style={{ width: '100%', background: 'none', border: 0, padding: 0, cursor: 'pointer' }} onClick={() => setChecksOpen(o => !o)} aria-expanded={checksOpen}>
                  <span style={{ color: 'inherit' }}>Before you apply</span><span className={open ? '' : 'all'}>{open ? `${open} open` : 'All checked'}</span>
                </button>
              ) : (
                <div className="lab">Before you apply<span className={open ? '' : 'all'}>{open ? `${open} open` : 'All checked'}</span></div>
              )}
              {(!mobile || checksOpen) && lead.checks.map((c, i) => (
                <button type="button" key={i} className={`check ${c.done ? 'done' : ''}`} onClick={() => toggleCheck(lead, i)} aria-pressed={c.done}>
                  <span className="box" aria-hidden="true">{c.done ? <svg width="11" height="9" viewBox="0 0 11 9"><path d="M1 4.5 4 7.5 10 1.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}</span>
                  <span className="text">{c.text}</span>
                </button>
              ))}
            </div>
          )}
          <div className="acts">
            <button className="btn btn-primary" disabled={busy === lead.id} onClick={() => apply(lead)}>{busy === lead.id ? 'Building…' : 'Apply and build resume'}</button>
            <button className="btn btn-secondary" onClick={() => hold(lead)}>Hold</button>
            <button className="btn btn-ghost" onClick={() => skip(lead)}>Skip</button>
            <span className="spacer" />
            <span className="keys" aria-hidden="true">A · H · S</span>
            {lead.report && <a className="report" href={lead.report} target="_blank" rel="noreferrer">Report</a>}
          </div>
        </article>
      )}

      {rest.length > 0 && (
        <>
          <div className="section">
            <h2>{allWatch ? 'Maybes' : 'Next'}</h2>
            <span className={allWatch ? '' : 'tone-fit'}>{allWatch ? 'Scored 3.5 to 3.9' : 'Strong matches first'}</span>
          </div>
          {rest.map((j, i) => (
            <div key={j.id} className={`maybe ${keyed && focus === i + 1 ? 'focused' : ''}`} aria-current={keyed && focus === i + 1 ? 'true' : undefined}>
              <span className="idx">{String(i + 2).padStart(2, '0')}</span>
              <div>
                <h3><Link href={`/jobs/${encodeURIComponent(j.id)}`}>{j.role}</Link></h3>
                <div className="meta">{j.meta}</div>
                {j.fit && <div className="line"><b className="tone-fit">Fits.</b> {j.fit}</div>}
                {j.watch && <div className="line"><b className="tone-watch">Watch.</b> {j.watch}</div>}
              </div>
              <div className="right">
                <Score value={j.score} size="sm" />
                <div className="btns">
                  {j.tone === 'fit' && <button className="btn btn-primary btn-sm" disabled={busy === j.id} onClick={() => apply(j)}>{busy === j.id ? 'Building…' : 'Apply'}</button>}
                  <button className="btn btn-secondary btn-sm" onClick={() => hold(j)}>Hold</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => skip(j)}>Skip</button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}

      {mobile && lead && (
        <div className="mbar" role="group" aria-label="Decide">
          <button className="btn btn-ghost" onClick={() => skip(lead)}>Skip</button>
          <button className="btn btn-secondary" onClick={() => hold(lead)}>Hold</button>
          <button className="btn btn-primary" disabled={busy === lead.id} onClick={() => apply(lead)}>{busy === lead.id ? 'Building…' : 'Apply'}</button>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={() => toast.undo?.()}>Undo</button>}
        </div>
      )}
    </div>
  );
}
