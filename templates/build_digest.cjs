#!/usr/bin/env node
// Build the daily digest email from a JSON spec. The routine writes the JSON; this file owns the layout.
//   node templates/build_digest.cjs runs/YYYY-MM-DD/digest.json runs/YYYY-MM-DD/digest.html [runs/YYYY-MM-DD/digest.txt]
// Prints the subject line to stdout. The .txt is the plain-text alternative for the email's `body` field.
//
// Spec (every list may be empty or omitted):
// {
//   "date": "2026-10-13",
//   "dashboard_url": null,                       // when the dashboard exists, the appendix moves there
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
//   "appendix": { new, carried, duplicates, rows: [ { company, role, url, location, source, result, resolution } ] },  // url optional
//   "drafts":   [ { title, text } ]
// }
// ROLE = { company, role, score, location, comp, why, apply_url, report (repo path or url), source, note }

const fs = require('fs');
const [specPath, htmlOut, txtOut] = process.argv.slice(2);
if (!specPath || !htmlOut) { console.error('usage: build_digest.cjs digest.json out.html [out.txt]'); process.exit(1); }
const S = JSON.parse(fs.readFileSync(specPath, 'utf-8'));
if (/—/.test(JSON.stringify(S))) throw new Error('em dash found in digest spec');

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const list = v => (Array.isArray(v) ? v : []);
const n = v => Number(v || 0);

// Palette: LinkedIn-adjacent, restrained. Inline styles only; email clients ignore stylesheets.
const C = { bg: '#f3f2ef', card: '#ffffff', ink: '#191919', mute: '#666666', line: '#e0dfdc', blue: '#0a66c2', green: '#057642', amber: '#915907', grey: '#56687a', greenBg: '#e6f4ea', amberBg: '#fdf3e1', greyBg: '#eef3f8' };
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const reportUrl = r => {
  if (!r) return null;
  if (/^https?:\/\//.test(r)) return r;
  if (S.repo_url && S.branch) return `${S.repo_url}/blob/${S.branch}/${r}`;
  return null;
};
const band = score => (score >= 4 ? ['Apply', C.green, C.greenBg] : score >= 3.5 ? ['Optional', C.amber, C.amberBg] : ['Skip', C.grey, C.greyBg]);

function pill(text, fg, bg) {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background-color:${bg};color:${fg};font-size:12px;font-weight:600;line-height:18px;">${esc(text)}</span>`;
}
function button(text, url, solid) {
  // Bulletproof button: the color sits on the td (bgcolor plus background-color) so Gmail keeps it.
  const bg = solid ? C.blue : '#ffffff', fg = solid ? '#ffffff' : C.blue;
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:0 8px 4px 0;"><tr><td bgcolor="${bg}" style="background-color:${bg};border:1px solid ${C.blue};border-radius:16px;padding:6px 16px;font:600 14px/18px ${FONT};"><a href="${esc(url)}" style="color:${fg};text-decoration:none;display:inline-block;">${esc(text)}</a></td></tr></table>`;
}
function h(text) {
  return `<tr><td style="padding:22px 0 8px 0;font:600 12px/16px ${FONT};letter-spacing:0.08em;text-transform:uppercase;color:${C.mute};">${esc(text)}</td></tr>`;
}
function card(inner) {
  return `<tr><td style="padding:0 0 10px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:8px;"><tr><td style="padding:16px 18px;font:400 14px/20px ${FONT};color:${C.ink};">${inner}</td></tr></table></td></tr>`;
}
function roleCard(r) {
  const score = Number(r.score);
  const [label, fg, bg] = band(score);
  const rep = reportUrl(r.report);
  const meta = [r.location, r.comp].filter(Boolean).map(esc).join(' &middot; ');
  return card(`
    <div style="margin-bottom:6px;">${pill(`${score.toFixed(1)} / 5`, fg, bg)} <span style="margin-left:6px;font-size:12px;color:${C.mute};">${esc(label)}${r.source ? ' &middot; ' + esc(r.source) : ''}</span></div>
    <div style="font-size:17px;line-height:22px;font-weight:600;margin-bottom:2px;"><a href="${esc(r.apply_url)}" style="color:${C.blue};text-decoration:none;">${esc(r.role)}</a></div>
    <div style="font-size:14px;color:${C.ink};margin-bottom:${meta ? 2 : 8}px;">${esc(r.company)}</div>
    ${meta ? `<div style="font-size:13px;color:${C.mute};margin-bottom:8px;">${meta}</div>` : ''}
    ${r.why ? `<div style="font-size:14px;line-height:20px;color:#333333;margin-bottom:${r.note ? 6 : 12}px;">${esc(r.why)}</div>` : ''}
    ${r.note ? `<div style="font-size:13px;line-height:18px;color:${C.amber};margin-bottom:12px;">${esc(r.note)}</div>` : ''}
    <div>${button('View posting', r.apply_url, true)}${rep ? button('Report', rep, false) : ''}</div>`);
}
function plainCard(lines) {
  return card(lines.filter(Boolean).map((l, i) => `<div style="${i === 0 ? 'font-weight:600;' : `color:${C.mute};font-size:13px;line-height:18px;`}margin-bottom:4px;">${l}</div>`).join(''));
}

const rows = [];
const top = list(S.top), opt = list(S.optional), fails = list(S.failures), res = list(S.resumes), cnv = list(S.could_not_verify), fu = list(S.followups), iv = list(S.interviews), sys = list(S.system), drafts = list(S.drafts);
const ap = S.appendix || {}; const apRows = list(ap.rows);
const subject = `Jobs ${S.date}: ${top.length + opt.length} new match${top.length + opt.length === 1 ? '' : 'es'}, ${cnv.length} to verify, ${fu.length} follow-up${fu.length === 1 ? '' : 's'}`;

// Header
rows.push(`<tr><td style="padding:8px 0 4px 0;font:700 22px/28px ${FONT};color:${C.ink};">Jobs, ${esc(S.date)}</td></tr>`);
if (S.headline) rows.push(`<tr><td style="padding:0 0 6px 0;font:400 15px/22px ${FONT};color:#333333;">${esc(S.headline)}</td></tr>`);

if (fails.length) {
  rows.push(h('System failures'));
  rows.push(card(`<div style="color:#b3261e;font-weight:600;margin-bottom:4px;">A step or connector failed this run</div>` + fails.map(f => `<div style="margin-bottom:4px;">${esc(f)}</div>`).join('')));
}
if (top.length) { rows.push(h('Recommended')); top.forEach(r => rows.push(roleCard(r))); }
if (opt.length) { rows.push(h('Optional, 3.5 to 3.9')); opt.forEach(r => rows.push(roleCard(r))); }
if (res.length) {
  rows.push(h('Resumes built'));
  res.forEach(r => rows.push(card(`
    <div style="font-size:16px;font-weight:600;margin-bottom:2px;">${esc(r.company)}<span style="font-weight:400;color:${C.mute};"> &middot; ${esc(r.role)}</span></div>
    ${r.changes ? `<div style="font-size:14px;line-height:20px;color:#333333;margin:6px 0;">${esc(r.changes)}</div>` : ''}
    ${r.approve ? `<div style="font-size:13px;line-height:18px;color:${C.amber};margin-bottom:10px;">${esc(r.approve)}</div>` : ''}
    <div>${r.review_url ? button('Review copy', r.review_url, true) : ''}${r.submit_url ? button('Submit copy', r.submit_url, false) : ''}</div>`)));
}
if (cnv.length) {
  rows.push(h('Could not verify'));
  cnv.forEach(r => rows.push(plainCard([
    `${esc(r.company)} &middot; ${esc(r.role)} ${pill(r.resolution || 'unresolved', C.grey, C.greyBg)}`,
    [r.feed, r.comp].filter(Boolean).map(esc).join(' &middot; '),
    r.tried ? `Tried: ${esc(r.tried)}` : '',
  ])));
}
if (fu.length) {
  rows.push(h('Follow-ups due'));
  fu.forEach(r => rows.push(plainCard([
    `${esc(r.company)} &middot; ${esc(r.role)} ${pill(r.status || '', C.blue, C.greyBg)}`,
    [r.last_touch ? `Last touch ${esc(r.last_touch)}` : '', r.contact ? esc(r.contact) : '', r.draft_ref ? esc(r.draft_ref) : ''].filter(Boolean).join(' &middot; '),
  ])));
}
if (iv.length) {
  rows.push(h('Interviews, next 48 hours'));
  iv.forEach(r => rows.push(card(`
    <div style="font-size:16px;font-weight:600;">${esc(r.company)} &middot; ${esc(r.role)}</div>
    <div style="font-size:13px;color:${C.mute};margin-bottom:8px;">${esc(r.when)}</div>
    ${list(r.prep).map(p => `<div style="font-size:14px;line-height:20px;margin-bottom:3px;">&bull; ${esc(p)}</div>`).join('')}`)));
}

// Pipeline tiles
const P = S.pipeline || {};
const tiles = [['Applied', P.applied], ['Responded', P.responded], ['Interview', P.interview], ['Offer', P.offer], ['Stale', P.stale]];
rows.push(h('Pipeline'));
rows.push(`<tr><td style="padding:0 0 10px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${tiles.map(([k, v], i) =>
  `<td width="20%" style="padding:0 ${i === tiles.length - 1 ? 0 : 6}px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:8px;"><tr><td style="padding:10px 6px;text-align:center;font:700 20px/24px ${FONT};color:${k === 'Stale' && n(v) ? C.amber : C.ink};">${n(v)}</td></tr><tr><td style="padding:0 6px 10px 6px;text-align:center;font:400 11px/14px ${FONT};color:${C.mute};">${esc(k)}</td></tr></table></td>`).join('')}</tr></table></td></tr>`);
if (P.note) rows.push(`<tr><td style="padding:0 0 6px 0;font:400 13px/18px ${FONT};color:${C.mute};">${esc(P.note)}</td></tr>`);

if (sys.length) {
  rows.push(h('System'));
  rows.push(card(sys.map(s => `<div style="font-size:13px;line-height:18px;color:${C.mute};margin-bottom:6px;">${esc(s)}</div>`).join('')));
}

// Appendix: everything that passed the filters. Moves to the dashboard once it exists.
if (S.dashboard_url) {
  rows.push(h('Everything that passed the filters'));
  rows.push(`<tr><td style="padding:0 0 10px 0;font:400 14px/20px ${FONT};">${n(ap.new)} new today, ${n(ap.duplicates)} duplicates not listed. ${button('Open the dashboard', S.dashboard_url, true)}</td></tr>`);
} else if (apRows.length) {
  rows.push(h(`Everything that passed the filters: ${n(ap.new)} new${ap.carried ? `, ${n(ap.carried)} carried from yesterday` : ''}${ap.duplicates ? `, ${n(ap.duplicates)} duplicates not listed` : ''}`));
  // Compact: cell styles are short and the font is set once on the wrapper so the email stays under Gmail's 102KB clip.
  const cell = `padding:6px 8px;border-bottom:1px solid ${C.line};vertical-align:top;`;
  const tr = apRows.map((r, i) => {
    const result = String(r.result || '');
    const m = result.match(/^(\d\.\d)/);
    const fg = m ? band(Number(m[1]))[1] : C.mute;
    const loc = String(r.location || ''); const locShort = loc.length > 70 ? loc.slice(0, 67).replace(/[,;\s]+\S*$/, '') + '...' : loc;
    const role = r.url ? `<a href="${esc(r.url)}" style="color:${C.blue};text-decoration:none;">${esc(r.role)}</a>` : `<span style="color:${C.mute};">${esc(r.role)}</span>`;
    return `<tr${i % 2 ? ' style="background-color:#fafafa;"' : ''}><td style="${cell}">${esc(r.company)}<br>${role}</td><td style="${cell}color:${C.mute};">${esc(locShort)}<br>${esc(r.source)}</td><td style="${cell}color:${fg};font-weight:600;white-space:nowrap;">${esc(result)}</td></tr>`;
  }).join('');
  rows.push(`<tr><td style="padding:0 0 10px 0;font:400 12px/16px ${FONT};color:${C.ink};"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.card}" style="background-color:${C.card};border:1px solid ${C.line};border-radius:8px;border-collapse:separate;font:400 12px/16px ${FONT};">${tr}</table></td></tr>`);
}

if (drafts.length) {
  rows.push(h('Drafts'));
  drafts.forEach(d => rows.push(card(`<div style="font-weight:600;margin-bottom:6px;">${esc(d.title)}</div><pre style="margin:0;white-space:pre-wrap;font:400 13px/19px ${FONT};color:#333333;">${esc(d.text)}</pre>`)));
}

rows.push(`<tr><td style="padding:18px 0 8px 0;font:400 11px/16px ${FONT};color:${C.mute};">jobops daily run, ${esc(S.date)}. Scores come from rubric/evaluate.md. Nothing is submitted by the system.</td></tr>`);

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body bgcolor="${C.bg}" style="margin:0;padding:0;background-color:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background-color:${C.bg};"><tr><td align="center" style="padding:16px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">
${rows.join('\n')}
</table></td></tr></table></body></html>`;

// Plain-text alternative, same order, raw URLs on their own lines.
const T = [];
T.push(`JOBS ${S.date}`); if (S.headline) T.push(S.headline); T.push('');
const roleTxt = r => { T.push(`${r.company} | ${r.role} | ${Number(r.score).toFixed(1)}/5 | ${[r.location, r.comp].filter(Boolean).join(' | ')}`); if (r.why) T.push(`  ${r.why}`); if (r.note) T.push(`  ${r.note}`); T.push(`  ${r.apply_url}`); const u = reportUrl(r.report); if (u) T.push(`  Report: ${u}`); T.push(''); };
if (fails.length) { T.push('SYSTEM FAILURES'); fails.forEach(f => T.push(`- ${f}`)); T.push(''); }
if (top.length) { T.push('RECOMMENDED'); top.forEach(roleTxt); }
if (opt.length) { T.push('OPTIONAL, 3.5 TO 3.9'); opt.forEach(roleTxt); }
if (res.length) { T.push('RESUMES BUILT'); res.forEach(r => { T.push(`${r.company} | ${r.role}`); if (r.changes) T.push(`  ${r.changes}`); if (r.approve) T.push(`  ${r.approve}`); if (r.review_url) T.push(`  Review: ${r.review_url}`); if (r.submit_url) T.push(`  Submit: ${r.submit_url}`); T.push(''); }); }
if (cnv.length) { T.push('COULD NOT VERIFY'); cnv.forEach(r => T.push(`${r.company} | ${r.role} | ${r.feed || ''} | ${r.resolution || ''}${r.tried ? ` | tried: ${r.tried}` : ''}`)); T.push(''); }
if (fu.length) { T.push('FOLLOW-UPS DUE'); fu.forEach(r => T.push(`${r.company} | ${r.role} | ${r.status || ''} | last touch ${r.last_touch || 'n/a'} | ${r.contact || ''}`)); T.push(''); }
if (iv.length) { T.push('INTERVIEWS NEXT 48H'); iv.forEach(r => { T.push(`${r.company} | ${r.role} | ${r.when}`); list(r.prep).forEach(p => T.push(`  - ${p}`)); }); T.push(''); }
T.push('PIPELINE'); T.push(tiles.map(([k, v]) => `${k} ${n(v)}`).join(' | ')); if (P.note) T.push(P.note); T.push('');
if (sys.length) { T.push('SYSTEM'); sys.forEach(s => T.push(`- ${s}`)); T.push(''); }
if (S.dashboard_url) { T.push(`Everything that passed the filters: ${S.dashboard_url}`); }
else if (apRows.length) { T.push(`EVERYTHING THAT PASSED THE FILTERS (${n(ap.new)} new, ${n(ap.duplicates)} duplicates not listed)`); apRows.forEach(r => T.push(`${r.company} | ${r.role} | ${r.location || ''} | ${r.source || ''} | ${r.result || ''} | ${r.resolution || ''}`)); T.push(''); }
if (drafts.length) { T.push('----------'); drafts.forEach(d => { T.push(d.title); T.push(d.text); T.push(''); }); }

fs.writeFileSync(htmlOut, html);
if (txtOut) fs.writeFileSync(txtOut, T.join('\n'));
process.stdout.write(subject + '\n');
