#!/usr/bin/env node
// Build a resume .docx from a JSON spec. Red runs for new/changed text.
//   node templates/build_resume_docx.cjs spec.json out.docx [--submit]
// --submit renders every run black (the submission copy).
//
// Spec: { header, contact, profile, tools, roles: [{ company, title, intro, bullets: [...] }], additional }
// Every text field is a "segs" value: a string, or an array whose items are strings (black)
// or { "r": "..." } objects (red). Layout matches the master described in profile/resume-master.md.

const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, AlignmentType, LevelFormat, BorderStyle } = require('docx');

const [specPath, outPath, flag] = process.argv.slice(2);
if (!specPath || !outPath) { console.error('usage: build_resume_docx.cjs spec.json out.docx [--submit]'); process.exit(1); }
const SUBMIT = flag === '--submit';
const spec = JSON.parse(fs.readFileSync(specPath, 'utf-8'));

const FONT = 'Arial', BODY = 19, RED = 'FF0000';
const segs = v => (typeof v === 'string' ? [v] : v);
function runs(v, o = {}) {
  return segs(v).map(s => {
    const red = typeof s === 'object';
    const text = red ? s.r : s;
    if (/—/.test(text)) throw new Error('em dash found in: ' + text.slice(0, 60));
    return new TextRun({ text, font: FONT, size: o.size || BODY, bold: !!o.bold, color: red && !SUBMIT ? RED : '000000' });
  });
}
const P = (v, o = {}) => new Paragraph({ alignment: o.align || AlignmentType.LEFT, spacing: { before: o.before || 0, after: o.after || 0, line: 252 }, children: runs(v, o) });
const bullet = v => new Paragraph({ numbering: { reference: 'bul', level: 0 }, spacing: { before: 0, after: 20, line: 252 }, children: runs(v) });
const section = t => new Paragraph({ spacing: { before: 200, after: 60 }, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: '000000', space: 1 } }, children: [new TextRun({ text: t, font: FONT, size: 22, bold: true })] });

const children = [
  P([String(spec.name || 'YOUR NAME').toUpperCase()], { align: AlignmentType.CENTER, bold: true, size: 32, after: 40 }),
  P(spec.header, { align: AlignmentType.CENTER, after: 40 }),
  P(spec.contact || 'email | phone | LinkedIn | City, ST', { align: AlignmentType.CENTER, after: 40 }),
  section('PROFILE'), P(spec.profile, { after: 40 }),
  section('AI AND CONTENT TOOLS'), P(spec.tools, { after: 40 }),
  section('EXPERIENCE'),
];
for (const r of spec.roles) {
  children.push(P(r.company, { bold: true, size: 20, before: 140 }));
  children.push(P(r.title, { bold: true, size: 20, after: 20 }));
  if (r.intro) children.push(P(r.intro, { after: 40 }));
  for (const b of r.bullets || []) children.push(bullet(b));
}
children.push(section('ADDITIONAL EXPERIENCE'), P(spec.additional, { after: 40 }));

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 220 } } } }] }] },
  sections: [{ properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 720, bottom: 720, left: 1008, right: 1008 } } }, children }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(outPath, buf); console.log('wrote', outPath, SUBMIT ? '(submit, all black)' : '(review, red marks)'); });
