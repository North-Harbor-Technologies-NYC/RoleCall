'use client';
// Contextual actions for one role, used on Pipeline rows and the job page. Every change shows a toast with Undo,
// which re-PATCHes the previous action and status. Apply fires the resume build through /api/jobs/:id/build-resume.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = { id: string; action: string; status: string; hasResume: boolean; appliedDate?: string | null; compact?: boolean };
type Toast = { text: string; undo?: () => Promise<void> } | null;
const today = () => new Date().toISOString().slice(0, 10);

export default function JobActions({ id, action, status, hasResume, appliedDate, compact }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<Toast>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const show = (t: Toast) => { if (timer.current) clearTimeout(timer.current); setToast(t); timer.current = setTimeout(() => setToast(null), 4000); };
  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b.error || `HTTP ${res.status}`); }
  }
  async function change(body: Record<string, unknown>, label: string) {
    const prev = { action, status, applied_date: appliedDate || null };
    setBusy(true);
    try { await patch(body); } catch (e) { setBusy(false); show({ text: `Could not save: ${(e as Error).message}` }); return; }
    setBusy(false); router.refresh();
    show({ text: label, undo: async () => { try { await patch(prev); setToast(null); router.refresh(); } catch (e) { show({ text: `Undo failed: ${(e as Error).message}` }); } } });
  }
  async function apply() {
    const prev = { action, status };
    setBusy(true);
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}/build-resume`, { method: 'POST' });
    const b = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { show({ text: `Could not start: ${b.error?.error || b.error || res.status}` }); return; }
    router.refresh();
    show({ text: b.fired ? 'Marked Apply. Resume lands in a few minutes.' : 'Marked Apply. The next run builds the resume.', undo: async () => { try { await patch(prev); setToast(null); router.refresh(); } catch (e) { show({ text: `Undo failed: ${(e as Error).message}` }); } } });
  }

  const sm = compact ? ' btn-sm' : '';
  const B = ({ kind, label, onClick }: { kind: 'primary' | 'secondary' | 'ghost' | 'needs'; label: string; onClick: () => void }) => (
    <button type="button" className={`btn btn-${kind}${sm}`} disabled={busy} onClick={onClick}>{busy && label === 'Apply' ? 'Building…' : label}</button>
  );

  let body: React.ReactNode = null;
  if (status === 'Evaluated') {
    if (action === 'Apply') body = <><B kind="secondary" label="Mark applied" onClick={() => change({ status: 'Applied', action: '' }, 'Marked applied.')} /><B kind="ghost" label="Clear" onClick={() => change({ action: '' }, 'Cleared the action.')} /></>;
    else if (action === 'Hold') body = <><B kind="primary" label="Apply" onClick={apply} /><B kind="ghost" label="Skip" onClick={() => change({ action: 'Skip' }, 'Skipped.')} /></>;
    else if (action === 'Skip') body = <B kind="ghost" label="Reopen" onClick={() => change({ action: '' }, 'Reopened.')} />;
    else body = <><B kind="primary" label="Apply" onClick={apply} /><B kind="secondary" label="Hold" onClick={() => change({ action: 'Hold' }, 'Held.')} /><B kind="ghost" label="Skip" onClick={() => change({ action: 'Skip' }, 'Skipped.')} /></>;
  } else if (status === 'Applied') {
    if (!appliedDate) body = dateOpen ? (
      <form className="actions" onSubmit={e => { e.preventDefault(); const d = String(new FormData(e.currentTarget).get('d') || ''); if (d) { setDateOpen(false); void change({ applied_date: d, last_touch: d }, 'Date added.'); } }}>
        <input className="search" style={{ width: 160, height: compact ? 36 : 44 }} type="date" name="d" defaultValue={today()} max={today()} autoFocus />
        <button type="submit" className={`btn btn-primary${sm}`}>Save</button>
        <button type="button" className={`btn btn-ghost${sm}`} onClick={() => setDateOpen(false)}>Cancel</button>
      </form>
    ) : <B kind="needs" label="Add date" onClick={() => setDateOpen(true)} />;
    else body = <><B kind="secondary" label="Responded" onClick={() => change({ status: 'Responded', last_touch: today() }, 'Marked responded.')} /><B kind="ghost" label="Rejected" onClick={() => change({ status: 'Rejected', last_touch: today() }, 'Marked rejected.')} /></>;
  } else if (status === 'Responded') {
    body = <><B kind="secondary" label="Interview" onClick={() => change({ status: 'Interview', last_touch: today() }, 'Marked interview.')} /><B kind="ghost" label="Rejected" onClick={() => change({ status: 'Rejected', last_touch: today() }, 'Marked rejected.')} /></>;
  } else if (status === 'Interview') {
    body = <><B kind="primary" label="Offer" onClick={() => change({ status: 'Offer', last_touch: today() }, 'Marked offer.')} /><B kind="ghost" label="Rejected" onClick={() => change({ status: 'Rejected', last_touch: today() }, 'Marked rejected.')} /></>;
  } else if (['SKIP', 'Rejected', 'Discarded'].includes(status)) {
    body = <B kind="ghost" label="Reopen" onClick={() => change({ status: 'Evaluated', action: '' }, 'Reopened.')} />;
  }
  void hasResume;

  return (
    <div className="actions">
      {body}
      {toast && <div className="toast" role="status"><span>{toast.text}</span>{toast.undo && <button type="button" onClick={() => toast.undo?.()}>Undo</button>}</div>}
    </div>
  );
}
