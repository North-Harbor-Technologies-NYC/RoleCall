'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function NotesForm({ id, notes, contact, appliedDate, nextFollowup }: { id: string; notes: string; contact: string; appliedDate: string; nextFollowup: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  async function save(fd: FormData) {
    const body = { notes: String(fd.get('notes') || ''), contact: String(fd.get('contact') || ''), applied_date: String(fd.get('applied_date') || ''), next_followup: String(fd.get('next_followup') || '') };
    const res = await fetch(`/api/jobs/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (res.ok) { setMsg('Saved.'); router.refresh(); } else { const b = await res.json().catch(() => ({})); setMsg(`Could not save: ${b.error || res.status}`); }
    setTimeout(() => setMsg(null), 3000);
  }
  return (
    <form action={fd => start(() => save(fd))}>
      <div className="fields">
        <label className="field">Contact<input type="text" name="contact" defaultValue={contact} placeholder="Recruiter or hiring manager" /></label>
        <label className="field">Applied<input type="date" name="applied_date" defaultValue={appliedDate} /></label>
        <label className="field">Next follow-up<input type="date" name="next_followup" defaultValue={nextFollowup} /></label>
      </div>
      <label className="field" style={{ marginTop: 12 }}>Notes<textarea name="notes" defaultValue={notes} placeholder="Anything the routine should not overwrite" /></label>
      <div className="actions" style={{ marginTop: 12 }}><button className="btn btn-primary btn-sm" type="submit" disabled={pending}>Save</button>{msg && <span className="tone-mute" style={{ font: 'var(--rc-t-ui)' }}>{msg}</span>}</div>
    </form>
  );
}
