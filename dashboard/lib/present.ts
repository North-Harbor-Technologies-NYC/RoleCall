// Presentation helpers shared by server and client components. Pure functions, no database.
import type { Job } from '@/lib/db';

export type Tone = 'fit' | 'watch' | 'neutral' | 'none';
export type Check = { text: string; done: boolean };

export function scoreNum(s: string | number | null | undefined): number | null {
  if (s === null || s === undefined || s === '') return null;
  const n = Number(s); return Number.isNaN(n) ? null : n;
}
export function toneOf(s: string | number | null | undefined): Tone {
  const n = scoreNum(s); if (n === null) return 'none';
  return n >= 4 ? 'fit' : n >= 3.5 ? 'watch' : 'neutral';
}

// Older rows carry one `reason` paragraph. Split it into fit and watch at the first sentence that opens with
// "Held back" (or "Held to", "held at"), else at the last sentence. Rows the routine writes with fit/watch use those.
export function fitWatch(job: Pick<Job, 'reason'> & { fit?: string | null; watch?: string | null }): { fit: string; watch: string } {
  if (job.fit || job.watch) return { fit: job.fit || '', watch: job.watch || '' };
  const text = (job.reason || '').trim();
  if (!text) return { fit: '', watch: '' };
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [text];
  if (sentences.length === 1) {
    // One sentence: split at "; held" / ", held" / "but" when present.
    const m = text.match(/^(.*?)(?:[;,]\s*|\s+but\s+)((?:held|but |though |however)[^]*)$/i);
    if (m) return { fit: m[1].trim().replace(/[;,]$/, '') + '.', watch: m[2].trim().replace(/^but\s+/i, '').replace(/^\w/, c => c.toUpperCase()) };
    return { fit: text, watch: '' };
  }
  let i = sentences.findIndex(s => /^held (back|to|at)\b/i.test(s));
  if (i <= 0) i = sentences.length - 1;
  return { fit: sentences.slice(0, i).join(' '), watch: sentences.slice(i).join(' ') };
}

// Checklist. Routine-written `checks` win; otherwise derive from a note that starts "Before you use the report:".
export function checksOf(job: { checks?: unknown; notes?: string | null }): Check[] | null {
  if (Array.isArray(job.checks)) return (job.checks as Check[]).filter(c => c && typeof c.text === 'string').map(c => ({ text: c.text, done: !!c.done }));
  const note = (job.notes || '').trim();
  const m = note.match(/^Before you use the report:\s*(.+)$/is);
  if (!m) return null;
  const items = m[1].replace(/\.$/, '').split(/\s*(?:,|;|\band\b)\s*/).map(s => s.trim()).filter(s => s.length > 3);
  return items.length ? items.map(text => ({ text: text.replace(/^\w/, c => c.toUpperCase()), done: false })) : null;
}

export function compShort(c: string | null | undefined): string {
  if (!c) return '';
  if (/not stated|unknown|n\/a/i.test(c)) return '';
  // "$215,000 - $245,000" -> "$215K to $245K"; "$1,200,000" -> "$1.2M"; "$275K–$330K" stays in K.
  const money = (s: string) => s.replace(/\$\s?(\d[\d,]*)(?:\.\d+)?([kKmM])?\b/g, (_m, num: string, suffix?: string) => {
    const n = Number(num.replace(/,/g, ''));
    if (suffix) return `$${n}${suffix.toUpperCase()}`;
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (n >= 1000) return `$${Math.round(n / 1000)}K`;
    return `$${n}`;
  });
  return money(c).replace(/\s*(?:-|–|—|to)\s*(?=\$)/g, ' to ').replace(/\s+/g, ' ').trim();
}
export function locationShort(l: string | null | undefined): string {
  if (!l) return '';
  const s = l.replace(/\(.*?\)/g, '').replace(/,\s*(USA|United States|US)$/i, '').trim();
  const hybrid = /hybrid/i.test(l) ? ', hybrid' : /remote/i.test(l) ? ', remote' : /on[- ]?site|in office|days in/i.test(l) ? ', on site' : '';
  return (s.length > 34 ? s.slice(0, 32).replace(/[,\s]+$/, '') : s) + hybrid;
}
export function metaLine(job: Pick<Job, 'company' | 'location' | 'comp'>): string {
  return [job.company, locationShort(job.location), compShort(job.comp)].filter(Boolean).join(' · ');
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
export function numberWord(n: number): string { return n >= 0 && n < WORDS.length ? WORDS[n] : String(n); }
export function cap(s: string): string { return s.replace(/^\w/, c => c.toUpperCase()); }

export function greetingWord(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', hour12: false }).format(now));
  return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening';
}

export function firstName(session: { user?: { name?: string | null; email?: string | null } } | null): string {
  const env = process.env.OWNER_FIRST_NAME; if (env) return env;
  const n = session?.user?.name?.trim(); if (n) return n.split(/\s+/)[0];
  const e = session?.user?.email || ''; return cap(e.split('@')[0].split(/[._-]/)[0] || 'there');
}

export const RUN_TIME_LABEL = process.env.RUN_TIME_LABEL || '11:30 AM ET';

export function fmtDay(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }): string {
  if (!d) return '';
  const s = typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
  const [y, m, day] = s.split('-').map(Number);
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(new Date(Date.UTC(y, m - 1, day)));
}
export function isoDay(d: string | Date | null | undefined): string {
  if (!d) return ''; return typeof d === 'string' ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
export function mmdd(d: string | Date | null | undefined): string { const s = isoDay(d); return s ? s.slice(5) : ''; }

export function minutesBetween(a: string | Date | null | undefined, b: string | Date | null | undefined): number | null {
  if (!a || !b) return null; const ms = new Date(b).getTime() - new Date(a).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, Math.round(ms / 60000));
}

export const REPO = process.env.REPO_URL || 'https://github.com/REPLACE-WITH-YOUR/rolecall';
export const reportLink = (r: string | null | undefined, day: string | null | undefined) => !r ? null : /^https?:/.test(r) ? r : `${REPO}/blob/claude/runs-${isoDay(day)}/${r}`;

export const STATUS_TONE: Record<string, string> = { Applied: 'progress', Responded: 'responded', Interview: 'interview', Offer: 'fit', Evaluated: 'neutral', SKIP: 'neutral', Rejected: 'neutral', Discarded: 'neutral' };
export const STAGE_VAR: Record<string, string> = { Applied: 'var(--rc-progress)', Responded: 'var(--rc-responded)', Interview: 'var(--rc-interview)', Offer: 'var(--rc-fit)' };

// "gmail:linkedin" -> "LinkedIn alert", "scan:greenhouse" -> "Greenhouse board", "forward" -> "Forwarded".
export function sourceLabel(src: string | null | undefined): string {
  if (!src) return '';
  const m = src.match(/^(gmail|scan|ats|feed):\s*([\w-]+)/i);
  const nice = (w: string) => ({ linkedin: 'LinkedIn', smartrecruiters: 'SmartRecruiters', successfactors: 'SuccessFactors', icims: 'iCIMS', ukgpro: 'UKG Pro', oraclehcm: 'Oracle HCM', amazonjobs: 'Amazon Jobs', googlecareers: 'Google Careers', foxcareers: 'Fox Careers' }[w.toLowerCase()] || cap(w));
  if (!m) return src === 'forward' ? 'Forwarded' : src === 'manual' ? 'Added by hand' : cap(src);
  return m[1].toLowerCase() === 'gmail' ? `${nice(m[2])} alert` : `${nice(m[2])} board`;
}
