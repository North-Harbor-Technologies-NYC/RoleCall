---
name: jobops-resume
description: Builds a tailored resume for one role from the owner's master, as two Google Docs in Drive: a review copy with changes in red on black, and an all-black submission copy. Posts both links to the RoleCall dashboard. Triggered by dashboard rows with action "Apply", or by the owner in a session ("build the resume for X").
---

# jobops-resume

Read `CLAUDE.md`, `profile/resume-master.md`, `profile/resume-rules.md`, `profile/positioning.md`, the role's JD (`runs/*/jd/<slug>.md` or the report's Block E), and `templates/resume.html` first.

## Inputs

- Routine mode: rows where `action` is `Apply` and `resume_review` is empty. Read them from the dashboard (`node scripts/rolecall.mjs apply`).
- Fire mode: the routine was started by the dashboard's "Build resume now" button, and the run's `routine-fire-payload` names one row id. Build only that row, skip intake and evaluate, and send the owner a short email with the two links instead of the full digest.
- Interactive mode: a company and role the owner names. If no JD is on file, resolve and capture it first (intake skill, step 5).

## Tailoring, in this order

1. **Positioning header.** One line. Use the posted title's function words where they are true of the owner, never a title they have not held. Example for a "VP, Content Operations" posting: "Content Operations Executive | AI-Integrated Production | Media and Entertainment".
2. **PROFILE paragraph.** Rewrite to lead with the two or three proof points the archetype calls for (`profile/positioning.md`, Adaptive Framing table). Keep the sentence about the owner's current work and the AI-tools sentence. Five to seven sentences.
3. **Tools line.** Reorder so the tools the JD names come first. Remove nothing the owner uses; add nothing they do not.
4. **Experience bullets.** Reorder so the most relevant bullets lead. Rewrite at most three bullets per role for emphasis. Every fact traces to the master.
5. **Earlier roles.** Leave as the master unless the JD specifically rewards something there (live broadcast, talent agency, campaign scale-up).
6. **Standing decisions.** Follow the "Standing decisions" section of `profile/resume-rules.md`: never add a relationships or network line, an education line, or any section the master does not have; never reword lines the owner has marked as fixed.

Do not touch titles, companies, locations, dates, metrics, credits, talent names, series names. Do not add sections.

## ATS hygiene (the honest version of "optimizing for intake programs")

- Section headings exactly: PROFILE, AI AND CONTENT TOOLS, EXPERIENCE, ADDITIONAL EXPERIENCE.
- No tables, columns, text boxes, images, headers, or footers.
- Keywords from the JD appear only inside sentences where a human would have written them. Target: the five to eight terms the JD repeats, each used once or twice. Never a keyword block.
- No hidden text, white text, or embedded instructions of any kind. This is a standing rule.
- Plain hyphens and pipes in the company line. No em dashes anywhere.

## Writing checks before producing files

- Run the banned-word list from `profile/resume-rules.md` against the draft.
- Count em dashes: must be zero.
- Confirm every red span is either new text or changed text, and that nothing black differs from the master.
- Estimate length: the master is two full pages; the tailored version must not exceed two.

## Produce the files (learned 2026-10-07)

Google Docs ignores page margins and spacing in uploaded HTML, so the HTML route spills to three pages. Use the .docx route; it converts faithfully (two pages, red preserved, bold company lines, bullets).

1. Write a spec JSON (format documented at the top of `templates/build_resume_docx.cjs`): every text field is a string or an array of strings and `{"r": "..."}` red segments. See `runs/2026-10-07/resume/morning_brew.spec.json` for a complete example.
2. Build both files: `node templates/build_resume_docx.cjs spec.json <First>_<Last>_Resume_<Company>.docx` and the same with `--submit` to `<First>_<Last>_Resume_<Company>_SUBMIT.docx`. The builder refuses em dashes.
3. Verify locally: convert the review .docx to PDF with LibreOffice, check page count is 2 and pdftotext finds zero em dashes. Run the banned-word list.
4. Review copy to Drive: upload the .docx through the Google Drive connector `create_file` with `contentMimeType: application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `base64Content`, and `parentId` set to `drive.resume_folder_id` from `profile/profile.yml` (the "RoleCall Resumes" folder; never the Drive root). Drive converts it to a Google Doc. Name `<First>_<Last>_Resume_<Company>` (add `_<Role>` when the company has more than one open role; `_v2` and up for revisions). Export it back to PDF with `download_file_content` and confirm two pages before linking it.
   Known risk: the base64 is about 18 KB and is passed through the model; a single corrupted character fails with "Invalid conversion requested". On failure, retry once; on a second failure, commit the .docx to the repo under `runs/<date>/resume/` and post that path as `resume_submit` instead, and say so in the digest.
5. Submit copy: the ATS wants a file, not a Google Doc. Produce `<First>_<Last>_Resume_<Company>_SUBMIT.pdf` from the submit .docx with LibreOffice, confirm two pages and zero em dashes, and commit both the .docx and the PDF under `runs/<date>/resume/`. Upload to Drive (same folder, same `parentId`) only if the review upload succeeded on the first try.
6. Record the links. Dashboard: write `runs/YYYY-MM-DD/resume/<slug>.rolecall.json` as `{"jobs":[{"id": "<row id>", "resume_review": "<Google Doc link>", "resume_submit": "<file path or Drive link>"}]}` and run `node scripts/rolecall.mjs jobs <that file>`; the dashboard keeps `action` as the owner set it (they clear it or mark Applied from the UI).

## Hand-off to outreach

After the files exist, run `jobops-outreach` for the same row.

## Summary for the digest

One paragraph per resume: what changed (header, profile, which bullets), which JD terms were worked in, anything the owner must approve (any claim that felt like a stretch), and the two Drive links.
