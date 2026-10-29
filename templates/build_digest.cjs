#!/usr/bin/env node
// Build the daily digest email from a JSON spec. The routine writes the JSON; this file owns the layout.
//   node templates/build_digest.cjs runs/YYYY-MM-DD/digest.json runs/YYYY-MM-DD/digest.html [runs/YYYY-MM-DD/digest.txt]
// Prints the subject line to stdout. The .txt is the plain-text alternative for the email's `body` field.
//
// Layout follows the RoleCall dashboard design (2026-10-29): warm paper, one match card per recommended role with
// "Why it fits", "Worth knowing", and a "Before you apply" checklist, maybes as rows, a "Needs you" block, and the
// pipeline as one line. Inline styles only; email clients ignore stylesheets, so the oklch tokens are hex here.
//
// Spec (every list may be empty or omitted):
// {
//   "date": "2026-10-13",
//   "dashboard_url": null,                       // the dashboard's Feed page; when set, the appendix moves there
//   "repo_url": "https://github.com/<owner>/<repo>",
//   "branch": "claude/runs-2026-10-13",          // where reports/ and runs/ for this day live
//   "headline": "One recommended apply today and two optional roles.",
//   "top":      [ ROLE ],                        // 4.0 and up
//   "optional": [ ROLE ],                        // 3.5 to 3.9
//   "resumes":  [ { company, role, review_url, submit_url, changes, approve } ],
//   "could_not_verify": [ { company, role, feed, resolution, tried, comp } ],
//   "followups": [ { company, role, status, last_touch, contact, draft_ref } ],
//   "interviews": [ { company, role, when, prep: [5 lines] } ],
//   "pipeline": { applied, responded, interview, offer, rejected, stale, note },
//   "failures": [ "connector or step failures; printed at the top when present" ],
//   "system":   [ "one line each" ],
//   "run":      { threads, boards, scored, kept },   // optional, for the closing line
//   "appendix": { new, carried, duplicates, rows: [ { company, role, url, location, source, result, resolution } ] },  // url optional
//   "drafts":   [ { title, text } ]
// }
// ROLE = { id, company, role, score, location, comp, fit, watch, checks: [string], why, note, apply_url, report (repo path or url), source }
//   `fit` and `watch` are what the dashboard shows; `why` and `note` are the older single-paragraph fields and are
//   used as the fallback (why split at "Held back", note as the checklist when it starts "Before you use the report:").
//   `id` is the dashboard row id; with dashboard_url set it links the card to /jobs/<id>.

const fs = require('fs');
const [specPath, htmlOut, txtOut] = process.argv.slice(2);
if (!specPath || !htmlOut) { console.error('usage: build_digest.cjs digest.json out.html [out.txt]'); process.exit(1); }
const S = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
if (/—/.test(JSON.stringify(S))) throw new Error('em dash found in digest spec');

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = v => (Array.isArray(v) ? v : []);
const n = v => Number(v || 0);

// Tokens (dashboard/app/globals.css), as hex.
const C = {
  paper: '#F5F1E9', surface: '#FFFDF8', ink: '#17150F', ink2: '#4F4840', mute: '#5A544A', faint: '#7A7468', dim: '#9A9386',
  line: '#E3DCCE', lineSoft: '#F0EBE1', lineStrong: '#CFC6B5', track: '#EEE8DC',
  fit: '#258651', fitStrong: '#1E7546', fitInk: '#005E31', fitChip: '#DDF6E4', fitTint: '#E7F9EC',
  watch: '#B47825', watchInk: '#874E00', watchChip: '#FFEBD2', watchTint: '#FFF1DE', watchLine: '#C69356',
  progress: '#3275B4', progressInk: '#0E5794', progressChip: '#E0F1FF', responded: '#7163B2', interview: '#008388',
  needs: '#BC4F54', needsStrong: '#AB4046', needsInk: '#99383E', needsChip: '#FFE7E6', needsTint: '#FFEAE9', needsLine: '#FDC8C7',
};
const FONT = "'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";

const reportUrl = r => (!r ? null : /^https?:\/\//.test(r) ? r : (S.repo_url && S.branch ? `${S.repo_url}/blob/${S.branch}/${r}` : null));
const dashBase = S.dashboard_url ? String(S.dashboard_url).replace(/\/feed\/?$/, '').replace(/\/$/, '') : null;
const jobUrl = r => (dashBase && r.id ? `${dashBase}/jobs/${encodeURIComponent(r.id)}` : null);
const tone = score => (score >= 4 ? 'fit' : score >= 3.5 ? 'watch' : 'neutral');
const toneInk = t => (t === 'fit' ? C.fitInk : t === 'watch' ? C.watchInk : C.mute);

// Fit, watch, and checks with the fallbacks the dashboard uses for older rows.
function fitWatch(r) {
  if (r.fit || r.watch) return { fit: r.fit || '', watch: r.watch || '' };
  const text = String(r.why || '').trim(); if (!text) return { fit: '', watch: '' };
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map(s => s.trim()).filter(Boolean) || [text];
  if (sentences.length === 1) {
    const m = text.match(/^(.*?)(?:[;,]\s*|\s+but\s+)((?:held|but |though |however)[^]*)$/i);
    if (m) return { fit: m[1].trim().replace(/[;,]$/, '') + '.', watch: m[2].trim().replace(/^but\s+/i, '').replace(/^\w/, c => c.toUpperCase()) };
    return { fit: text, watch: '' };
  }
  let i = sentences.findIndex(s => /^held (back|to|at)\b/i.test(s)); if (i <= 0) i = sentences.length - 1;
  return { fit: sentences.slice(0, i).join(' '), watch: sentences.slice(i).join(' ') };
}
function checksOf(r) {
  if (Array.isArray(r.checks)) return r.checks.map(c => (typeof c === 'string' ? c : c && c.text)).filter(Boolean);
  const m = String(r.note || '').trim().match(/^Before you use the report:\s*(.+)$/is);
  if (!m) return [];
  return m[1].replace(/\.$/, '').split(/\s*(?:,|;|\band\b)\s*/).map(s => s.trim()).filter(s => s.length > 3).map(s => s.replace(/^\w/, c => c.toUpperCase()));
}
function compShort(c) {
  if (!c || /not stated|unknown|n\/a/i.test(c)) return '';
  const money = String(c).replace(/\$\s?(\d[\d,]*)(?:\.\d+)?([kKmM])?\b/g, (_m, num, suf) => { const v = Number(num.replace(/,/g, '')); if (suf) return `$${v}${suf.toUpperCase()}`; if (v >= 1e6) return `$${(v / 1e6).toFixed(1).replace(/\.0$/, '')}M`; if (v >= 1000) return `$${Math.round(v / 1000)}K`; return `$${v}`; });
  return money.replace(/\s*(?:-|–|to)\s*(?=\$)/g, ' to ').replace(/\s+/g, ' ').trim();
}
function locShort(l) {
  if (!l) return ''; const s = String(l).replace(/\(.*?\)/g, '').replace(/,\s*(USA|United States|US)$/i, '').trim();
  const mode = /hybrid/i.test(l) ? ', hybrid' : /remote/i.test(l) ? ', remote' : /on[- ]?site|in office|days in/i.test(l) ? ', on site' : '';
  const short = s.length > 34 ? s.slice(0, 32).replace(/[,\s]+$/, '') : s;
  return new RegExp(mode.replace(', ', ''), 'i').test(short) || !mode ? short : short + mode;
}
const metaLine = r => [r.company, locShort(r.location), compShort(r.comp)].filter(Boolean).map(esc).join(' &middot; ');
const srcLabel = s => { if (!s) return ''; const m = String(s).match(/^(gmail|scan|ats|feed):\s*([\w-]+)/i); const cap = w => w.replace(/^\w/, c => c.toUpperCase()); if (!m) return cap(String(s)); const w = m[2].toLowerCase() === 'linkedin' ? 'LinkedIn' : cap(m[2]); return m[1].toLowerCase() === 'gmail' ? `${w} alert` : `${w} board`; };

// Primitives. Every colored thing sits on a td with bgcolor plus background-color so Gmail keeps it.
function button(text, url, kind) {
  const st = kind === 'primary' ? { bg: C.fitStrong, fg: '#FFFFFF', border: C.fitStrong } : kind === 'needs' ? { bg: C.needsStrong, fg: '#FFFFFF', border: C.needsStrong } : kind === 'ink' ? { bg: C.ink, fg: C.paper, border: C.ink } : { bg: C.surface, fg: C.ink, border: C.lineStrong };
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:0 8px 6px 0;"><tr><td bgcolor="${st.bg}" style="background-color:${st.bg};border:1px solid ${st.border};border-radius:8px;padding:9px 16px;font:600 14px/16px ${FONT};"><a href="${esc(url)}" style="color:${st.fg};text-decoration:none;display:inline-block;">${esc(text)}</a></td></tr></table>`;
}
const chip = (text, t) => { const m = { fit: [C.fitChip, C.fitInk], watch: [C.watchChip, C.watchInk], progress: [C.progressChip, C.progressInk], needs: [C.needsChip, C.needsInk], neutral: [C.track, C.mute] }[t] || [C.track, C.mute]; return `<span style="display:inline-block;padding:3px 9px;border-radius:6px;background-color:${m[0]};color:${m[1]};font:600 12px/14px ${FONT};">${esc(text)}</span>`; };
const score = (v, size) => { const s = Number(v); const t = tone(s); return `<span style="font:600 ${size === 'lg' ? '30px/30px' : '20px/20px'} ${FONT};color:${toneInk(t)};letter-spacing:-0.02em;">${Number.isNaN(s) ? '&ndash;' : s.toFixed(1)}</span>`; };
const section = (title, right) => `<tr><td style="padding:28px 0 8px 0;border-bottom:1px solid ${C.line};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 18px/22px ${FONT};color:${C.ink};">${esc(title)}</td>${right ? `<td align="right" style="font:600 13px/18px ${FONT};color:${C.watchInk};">${right}</td>` : ''}</tr></table></td></tr>`;
const surface = (inner, pad = '18px 20px', extra = '') => `<tr><td style="padding:12px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.line};border-radius:10px;${extra}"><tr><td style="padding:${pad};font:400 15px/22px ${FONT};color:${C.ink};">${inner}</td></tr></table></td></tr>`;
const notice = (inner, t) => { const m = t === 'needs' ? [C.needsTint, C.needsLine, C.needsInk] : [C.fitTint, '#B9E4C6', C.fitInk]; return `<tr><td style="padding:12px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${m[0]}" style="background-color:${m[0]};border:1px solid ${m[1]};border-radius:10px;"><tr><td style="padding:14px 18px;font:400 14px/21px ${FONT};color:${C.ink2};">${inner}</td></tr></table></td></tr>`; };

// The lead match card.
function matchCard(r, idx) {
  const s = Number(r.score); const t = tone(s); const fw = fitWatch(r); const checks = checksOf(r); const rep = reportUrl(r.report); const ju = jobUrl(r);
  const panel = (lab, text, bg, fg) => `<td width="50%" valign="top" style="padding:0 6px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${bg}" style="background-color:${bg};border-radius:8px;"><tr><td style="padding:14px 16px;font:400 15px/22px ${FONT};color:${C.ink2};"><div style="font:600 13px/16px ${FONT};color:${fg};margin-bottom:6px;">${lab}</div>${esc(text)}</td></tr></table></td>`;
  const panels = (fw.fit || fw.watch) ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>${fw.fit ? panel('Why it fits', fw.fit, C.fitTint, C.fitInk) : ''}${fw.watch ? panel('Worth knowing', fw.watch, C.watchTint, C.watchInk).replace('padding:0 6px 0 0', fw.fit ? 'padding:0 0 0 6px' : 'padding:0') : ''}</tr></table>` : '';
  const checklist = checks.length ? `<div style="margin-top:16px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 14px/20px ${FONT};color:${C.ink};">Before you apply</td><td align="right" style="font:600 14px/20px ${FONT};color:${C.watchInk};">${checks.length} open</td></tr></table>${checks.map((c, i) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td width="18" valign="top" style="padding:9px 0 0 0;"><span style="display:inline-block;width:14px;height:14px;border:1.5px solid ${C.watchLine};border-radius:4px;"></span></td><td style="padding:8px 0 8px 10px;font:400 15px/22px ${FONT};color:${C.ink};${i < checks.length - 1 ? `border-bottom:1px solid ${C.lineSoft};` : ''}">${esc(c)}</td></tr></table>`).join('')}</div>` : '';
  const accent = t === 'fit' ? C.fit : C.watch;
  return `<tr><td style="padding:12px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.line};border-top:4px solid ${accent};border-radius:10px;"><tr><td style="padding:18px 22px 20px 22px;font:400 15px/22px ${FONT};color:${C.ink};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="vertical-align:top;"><span style="font:500 12px/16px ${MONO};color:${C.dim};margin-right:8px;">${String(idx).padStart(2, '0')}</span>${chip(t === 'fit' ? 'Strong match' : 'Maybe', t)}</td><td align="right" style="vertical-align:top;">${score(s, 'lg')}</td></tr></table>
    <div style="font:600 24px/30px ${FONT};color:${C.ink};letter-spacing:-0.02em;margin-top:8px;"><a href="${esc(ju || r.apply_url)}" style="color:${C.ink};text-decoration:none;">${esc(r.role)}</a></div>
    <div style="font:400 15px/22px ${FONT};color:${C.mute};margin-top:2px;">${metaLine(r)}</div>
    ${panels}${checklist}
    <div style="margin-top:18px;">${ju ? button('Open in RoleCall', ju, 'primary') : ''}${button('Posting', r.apply_url, 'secondary')}${rep ? button('Report', rep, 'secondary') : ''}</div>
  </td></tr></table></td></tr>`;
}
// A maybe row.
function maybeRow(r, idx, last) {
  const s = Number(r.score); const fw = fitWatch(r); const ju = jobUrl(r);
  return `<tr><td style="padding:16px 0;border-bottom:1px solid ${last ? C.line : C.lineSoft};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    <td width="30" valign="top" style="font:500 12px/16px ${MONO};color:${C.dim};padding-top:5px;">${String(idx).padStart(2, '0')}</td>
    <td valign="top" style="font:400 15px/22px ${FONT};color:${C.ink2};">
      <div style="font:600 17px/24px ${FONT};color:${C.ink};"><a href="${esc(ju || r.apply_url)}" style="color:${C.ink};text-decoration:none;">${esc(r.role)}</a></div>
      <div style="font:400 14px/20px ${FONT};color:${C.mute};">${metaLine(r)}</div>
      ${fw.fit ? `<div style="margin-top:8px;"><b style="color:${C.fitInk};">Fits.</b> ${esc(fw.fit)}</div>` : ''}
      ${fw.watch ? `<div style="margin-top:3px;"><b style="color:${C.watchInk};">Watch.</b> ${esc(fw.watch)}</div>` : ''}
      <div style="margin-top:10px;"><a href="${esc(r.apply_url)}" style="font:600 14px/18px ${FONT};color:${C.fitInk};text-decoration:none;">Posting</a>${reportUrl(r.report) ? ` &nbsp;&middot;&nbsp; <a href="${esc(reportUrl(r.report))}" style="font:600 14px/18px ${FONT};color:${C.mute};text-decoration:none;">Report</a>` : ''}</div>
    </td>
    <td width="56" align="right" valign="top">${score(s, 'sm')}</td>
  </tr></table></td></tr>`;
}

const rows = [];
const top = list(S.top), opt = list(S.optional), fails = list(S.failures), res = list(S.resumes), cnv = list(S.could_not_verify), fu = list(S.followups), iv = list(S.interviews), sys = list(S.system), drafts = list(S.drafts);
const ap = S.appendix || {}; const apRows = list(ap.rows); const P = S.pipeline || {}; const R = S.run || {};
const count = top.length + opt.length;
const subject = `Jobs ${S.date}: ${count} new match${count === 1 ? '' : 'es'}, ${cnv.length} to verify, ${fu.length} follow-up${fu.length === 1 ? '' : 's'}`;
const WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const niceDate = (() => { const [y, m, d] = String(S.date).split('-').map(Number); return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(Date.UTC(y, m - 1, d))); })();

// Header: wordmark, date, the decision count, the routine's headline with the two phrases colored.
rows.push(`<tr><td style="padding:4px 0 18px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 20px/24px ${FONT};color:${C.ink};letter-spacing:-0.02em;">Role<span style="color:${C.fitStrong};">Call</span></td><td align="right" style="font:400 13px/18px ${FONT};color:${C.faint};">${esc(niceDate)}</td></tr></table></td></tr>`);
rows.push(`<tr><td style="padding:0 0 10px 0;font:600 30px/36px ${FONT};color:${C.ink};letter-spacing:-0.025em;">${count === 0 ? 'Nothing to decide on today.' : `${WORDS[count] || count} ${count === 1 ? 'role' : 'roles'} to decide on.`}</td></tr>`);
if (S.headline) {
  const colored = esc(S.headline).replace(/\b((?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|no)\s+(?:recommended(?:\s+appl(?:y|ies))?|optional(?:\s+roles?)?))\b/gi, m => `<span style="color:${/recommended/i.test(m) ? C.fitInk : C.watchInk};font-weight:500;">${m}</span>`);
  rows.push(`<tr><td style="padding:0 0 4px 0;font:400 16px/24px ${FONT};color:${C.mute};">${colored}</td></tr>`);
}
if (fails.length) rows.push(notice(`<b style="color:${C.needsInk};">${fails.length === 1 ? 'A step failed this run.' : `${fails.length} steps failed this run.`}</b> ${fails.map(esc).join(' ')}`, 'needs'));

// Decisions: match cards for 4.0+, then maybes as rows. With no 4.0+, the best maybe becomes the card.
let idx = 1;
const lead = top.length ? top : opt.slice(0, 1);
const rest = top.length ? opt : opt.slice(1);
lead.forEach(r => rows.push(matchCard(r, idx++)));
if (rest.length) {
  rows.push(section(top.length ? 'Maybes' : 'More maybes', 'Scored 3.5 to 3.9'));
  rest.forEach((r, i) => rows.push(maybeRow(r, idx++, i === rest.length - 1)));
}
if (count === 0 && !fails.length) rows.push(`<tr><td style="padding:16px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px dashed ${C.lineStrong};border-radius:10px;"><tr><td align="center" style="padding:24px;font:600 17px/24px ${FONT};color:${C.ink};">All caught up<div style="font:400 14px/20px ${FONT};color:${C.mute};">Nothing scored 3.5 or above today.</div></td></tr></table></td></tr>`);

if (res.length) {
  rows.push(section('Resumes built'));
  res.forEach(r => rows.push(surface(`
    <div style="font:600 17px/24px ${FONT};color:${C.ink};">${esc(r.company)} <span style="font-weight:400;color:${C.mute};">&middot; ${esc(r.role)}</span></div>
    ${r.changes ? `<div style="margin-top:6px;color:${C.ink2};">${esc(r.changes)}</div>` : ''}
    ${r.approve ? `<div style="margin-top:6px;font-size:14px;line-height:21px;color:${C.watchInk};">${esc(r.approve)}</div>` : ''}
    <div style="margin-top:14px;">${r.review_url ? button('Review copy', r.review_url, 'primary') : ''}${r.submit_url ? button('Submit copy', r.submit_url, 'secondary') : ''}</div>`)));
}

// Needs you: follow-ups due and whatever the pipeline note flags, in one block.
if (fu.length || n(P.stale) > 0 || P.note) {
  const title = fu.length ? `${fu.length} follow-up${fu.length === 1 ? ' is' : 's are'} due` : n(P.stale) ? `${n(P.stale)} application${n(P.stale) === 1 ? ' has' : 's have'} gone quiet` : 'Needs you';
  rows.push(`<tr><td style="padding:28px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.needsTint}" style="background-color:${C.needsTint};border:1px solid ${C.needsLine};border-radius:10px;"><tr><td style="padding:18px 20px;font:400 14px/21px ${FONT};color:${C.ink2};">
    <div style="font:600 12px/16px ${FONT};color:${C.needsInk};">Needs you</div>
    <div style="font:600 17px/24px ${FONT};color:${C.ink};margin-top:4px;">${esc(title)}</div>
    ${fu.map(r => `<div style="margin-top:10px;padding-top:10px;border-top:1px solid ${C.needsLine};"><b style="color:${C.ink};">${esc(r.company)}</b> &middot; ${esc(r.role)}${r.status ? ` &nbsp;${chip(r.status, 'progress')}` : ''}<div style="color:${C.mute};font-size:13px;line-height:19px;">${[r.last_touch ? `Last touch ${esc(r.last_touch)}` : '', r.contact ? esc(r.contact) : '', r.draft_ref ? esc(r.draft_ref) : ''].filter(Boolean).join(' &middot; ')}</div></div>`).join('')}
    ${P.note ? `<div style="margin-top:10px;">${esc(P.note)}</div>` : ''}
    ${dashBase ? `<div style="margin-top:14px;">${button('Open the pipeline', `${dashBase}/pipeline?status=applied`, 'needs')}</div>` : ''}
  </td></tr></table></td></tr>`);
}

if (iv.length) {
  rows.push(section('Interviews, next 48 hours'));
  iv.forEach(r => rows.push(surface(`<div style="font:600 17px/24px ${FONT};color:${C.ink};">${esc(r.company)} &middot; ${esc(r.role)}</div><div style="font-size:13px;color:${C.mute};margin-bottom:8px;">${esc(r.when)}</div>${list(r.prep).map(p => `<div style="margin-bottom:3px;">&bull; ${esc(p)}</div>`).join('')}`)));
}
if (cnv.length) {
  rows.push(section('Could not verify', `<span style="color:${C.mute};">${cnv.length}</span>`));
  cnv.forEach((r, i) => rows.push(`<tr><td style="padding:14px 0;border-bottom:1px solid ${i === cnv.length - 1 ? C.line : C.lineSoft};font:400 14px/21px ${FONT};color:${C.ink2};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 16px/22px ${FONT};color:${C.ink};">${esc(r.company)} &middot; ${esc(r.role)}</td><td align="right" valign="top">${chip((r.resolution || 'unresolved').replace(/^\w/, c => c.toUpperCase()), 'neutral')}</td></tr></table>${[r.feed ? srcLabel(r.feed) : '', r.comp ? compShort(r.comp) : ''].filter(Boolean).length ? `<div style="color:${C.mute};font-size:13px;">${[r.feed ? srcLabel(r.feed) : '', r.comp ? compShort(r.comp) : ''].filter(Boolean).map(esc).join(' &middot; ')}</div>` : ''}${r.tried ? `<div style="margin-top:4px;">${esc(r.tried)}</div>` : ''}</td></tr>`));
}

// Your search: one line with stage dots.
const stages = [['Applied', P.applied, C.progress], ['Responded', P.responded, C.responded], ['Interview', P.interview, C.interview], ['Offer', P.offer, C.fit]];
rows.push(`<tr><td style="padding:28px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.line};border-radius:10px;"><tr><td style="padding:14px 20px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="font:600 15px/20px ${FONT};color:${C.ink};padding-right:12px;white-space:nowrap;">Your search</td>${stages.map(([k, v, col]) => `<td style="font:400 14px/20px ${FONT};color:${C.ink2};white-space:nowrap;padding-right:8px;"><span style="display:inline-block;width:8px;height:8px;border-radius:4px;background-color:${col};margin-right:6px;"></span>${esc(k)} <b style="font-family:${MONO};font-weight:500;">${n(v)}</b></td>`).join('')}</tr></table></td></tr></table></td></tr>`);

if (sys.length) {
  rows.push(section('System notes'));
  rows.push(`<tr><td style="padding:10px 0 0 0;font:400 14px/21px ${FONT};color:${C.ink2};">${sys.map(s => `<div style="margin-bottom:8px;">${esc(s)}</div>`).join('')}</td></tr>`);
}

// Appendix: everything that passed the filters. Lives on the dashboard once it exists.
if (S.dashboard_url) {
  rows.push(`<tr><td style="padding:24px 0 0 0;font:400 14px/21px ${FONT};color:${C.mute};">${n(ap.new)} new postings passed the filters today, ${n(ap.duplicates)} duplicates not listed.</td></tr><tr><td style="padding:10px 0 0 0;">${button('Open the feed', S.dashboard_url, 'ink')}</td></tr>`);
} else if (apRows.length) {
  rows.push(section(`Everything that passed the filters`, `<span style="color:${C.mute};">${n(ap.new)} new${ap.carried ? `, ${n(ap.carried)} carried` : ''}${ap.duplicates ? `, ${n(ap.duplicates)} duplicates not listed` : ''}</span>`));
  const cell = `padding:6px 8px;border-bottom:1px solid ${C.lineSoft};vertical-align:top;`;
  const tr = apRows.map(r => { const result = String(r.result || ''); const m = result.match(/^(\d\.\d)/); const fg = m ? toneInk(tone(Number(m[1]))) : C.mute; const loc = String(r.location || ''); const locShortTxt = loc.length > 70 ? loc.slice(0, 67).replace(/[,;\s]+\S*$/, '') + '...' : loc; const role = r.url ? `<a href="${esc(r.url)}" style="color:${C.ink};text-decoration:none;">${esc(r.role)}</a>` : `<span style="color:${C.mute};">${esc(r.role)}</span>`; return `<tr><td style="${cell}">${esc(r.company)}<br>${role}</td><td style="${cell}color:${C.mute};">${esc(locShortTxt)}<br>${esc(r.source)}</td><td style="${cell}color:${fg};font-weight:600;white-space:nowrap;">${esc(result)}</td></tr>`; }).join('');
  rows.push(`<tr><td style="padding:12px 0 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.surface}" style="background-color:${C.surface};border:1px solid ${C.line};border-radius:10px;border-collapse:separate;font:400 12px/16px ${FONT};color:${C.ink};">${tr}</table></td></tr>`);
}
if (drafts.length) {
  rows.push(section('Drafts'));
  drafts.forEach(d => rows.push(surface(`<div style="font-weight:600;margin-bottom:6px;">${esc(d.title)}</div><pre style="margin:0;white-space:pre-wrap;font:400 14px/21px ${FONT};color:${C.ink2};">${esc(d.text)}</pre>`)));
}

// Run log line.
const runLine = (R.threads !== undefined || R.scored !== undefined) ? `This run read ${n(R.threads)} inbox thread${n(R.threads) === 1 ? '' : 's'} and ${n(R.boards)} boards, scored ${n(R.scored)} role${n(R.scored) === 1 ? '' : 's'}, and kept ${n(R.kept)}. ${fails.length ? `${fails.length} error${fails.length === 1 ? '' : 's'}.` : 'No errors.'}` : `RoleCall daily run, ${esc(S.date)}. Scores come from rubric/evaluate.md. Nothing is submitted by the system.`;
rows.push(`<tr><td style="padding:24px 0 8px 0;font:400 13px/20px ${FONT};color:${C.faint};">${runLine}</td></tr>`);

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body bgcolor="${C.paper}" style="margin:0;padding:0;background-color:${C.paper};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.paper}" style="background-color:${C.paper};"><tr><td align="center" style="padding:20px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
${rows.join('\n')}
</table></td></tr></table></body></html>`;

// Plain-text alternative, same order, raw URLs on their own lines.
const T = [];
T.push(`ROLECALL, ${niceDate}`); T.push(count === 0 ? 'Nothing to decide on today.' : `${WORDS[count] || count} ${count === 1 ? 'role' : 'roles'} to decide on.`); if (S.headline) T.push(S.headline); T.push('');
const roleTxt = r => { const fw = fitWatch(r); const checks = checksOf(r); T.push(`${r.company} | ${r.role} | ${Number(r.score).toFixed(1)}/5 | ${[locShort(r.location), compShort(r.comp)].filter(Boolean).join(' | ')}`); if (fw.fit) T.push(`  Why it fits: ${fw.fit}`); if (fw.watch) T.push(`  Worth knowing: ${fw.watch}`); checks.forEach(c => T.push(`  [ ] ${c}`)); const ju = jobUrl(r); if (ju) T.push(`  ${ju}`); T.push(`  ${r.apply_url}`); const u = reportUrl(r.report); if (u) T.push(`  Report: ${u}`); T.push(''); };
if (fails.length) { T.push('FAILURES'); fails.forEach(f => T.push(`- ${f}`)); T.push(''); }
if (lead.length) { T.push(top.length ? 'RECOMMENDED' : 'BEST MAYBE'); lead.forEach(roleTxt); }
if (rest.length) { T.push('MAYBES, 3.5 TO 3.9'); rest.forEach(roleTxt); }
if (res.length) { T.push('RESUMES BUILT'); res.forEach(r => { T.push(`${r.company} | ${r.role}`); if (r.changes) T.push(`  ${r.changes}`); if (r.approve) T.push(`  ${r.approve}`); if (r.review_url) T.push(`  Review: ${r.review_url}`); if (r.submit_url) T.push(`  Submit: ${r.submit_url}`); T.push(''); }); }
if (fu.length || n(P.stale) > 0 || P.note) { T.push('NEEDS YOU'); fu.forEach(r => T.push(`${r.company} | ${r.role} | ${r.status || ''} | last touch ${r.last_touch || 'n/a'} | ${r.contact || ''}`)); if (P.note) T.push(P.note); T.push(''); }
if (iv.length) { T.push('INTERVIEWS NEXT 48H'); iv.forEach(r => { T.push(`${r.company} | ${r.role} | ${r.when}`); list(r.prep).forEach(p => T.push(`  - ${p}`)); }); T.push(''); }
if (cnv.length) { T.push('COULD NOT VERIFY'); cnv.forEach(r => T.push(`${r.company} | ${r.role} | ${r.feed || ''} | ${r.resolution || ''}${r.tried ? ` | tried: ${r.tried}` : ''}`)); T.push(''); }
T.push('YOUR SEARCH'); T.push(stages.map(([k, v]) => `${k} ${n(v)}`).join(' | ')); T.push('');
if (sys.length) { T.push('SYSTEM NOTES'); sys.forEach(s => T.push(`- ${s}`)); T.push(''); }
if (S.dashboard_url) { T.push(`${n(ap.new)} new postings passed the filters today: ${S.dashboard_url}`); }
else if (apRows.length) { T.push(`EVERYTHING THAT PASSED THE FILTERS (${n(ap.new)} new, ${n(ap.duplicates)} duplicates not listed)`); apRows.forEach(r => T.push(`${r.company} | ${r.role} | ${r.location || ''} | ${r.source || ''} | ${r.result || ''} | ${r.resolution || ''}`)); T.push(''); }
if (drafts.length) { T.push('----------'); drafts.forEach(d => { T.push(d.title); T.push(d.text); T.push(''); }); }
T.push(runLine.replace(/&[a-z]+;/g, ''));

fs.writeFileSync(htmlOut, html);
if (txtOut) fs.writeFileSync(txtOut, T.join('\n'));
process.stdout.write(subject + '\n');
