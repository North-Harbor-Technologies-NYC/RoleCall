# RoleCall

A private job-search system for the owner named in `profile/profile.yml`. Runs as Claude Code routines (cloud) and interactive sessions. This file is loaded by every session and every routine run. Read it fully before doing anything.

## What this repo is

The config and intelligence layer for a daily job-search pipeline. The plumbing lives outside the repo:

| Concern | Where it lives |
|---|---|
| Inbound job alerts | Gmail (label named in `profile/profile.yml`, `gmail.inbox_label`), via the Gmail connector |
| Zero-token feed | `feeds/latest.json`, committed each morning by `.github/workflows/feed.yml` running `portals/scan.mjs` |
| Tracker | The RoleCall dashboard (Postgres on Neon behind the URL in `ROLECALL_URL`; schema in `data/tracker.md`, client in `scripts/rolecall.mjs`) |
| Tailored resumes | Google Docs in Drive, built from `profile/resume-master.md` |
| Daily digest | Email to the owner via the Gmail connector |
| Interviews | Google Calendar, via the Calendar connector |

## Sources of truth, in reading order

1. `profile/profile.yml`: identity, comp targets, location, Gmail labels.
2. `profile/positioning.md`: target archetypes, framing per archetype, exit narrative, green and red flags, location scoring, red-flag questions.
3. `profile/resume-master.md`: the current master resume. The canonical .docx lives in Drive; this is the text the model reads.
4. `profile/resume-rules.md`: formatting and writing rules for anything resume-shaped. Non-negotiable.
5. `rubric/blockers.yml`: hard filters applied before any scoring.
6. `rubric/evaluate.md`: the A-G evaluation.
7. `profile/story-bank.md`: STAR+R stories, appended to over time.
8. `data/history.md`: everything already evaluated or applied to before this system existed. Check before evaluating anything, to avoid re-scoring a role the owner has already seen.

## Global rules

NEVER
- Invent experience, metrics, titles, or dates. Everything on a resume must trace to `profile/resume-master.md` or to something the owner stated.
- Submit an application. The system prepares; the owner submits.
- Use em dashes anywhere in generated text. Use commas or restructure the sentence.
- Echo job-description phrasing back verbatim in a resume. Lead the reader to the conclusion.
- Score a role before running `rubric/blockers.yml`. Blocked roles get logged with the blocker and no further tokens.
- Put the owner's phone number in outbound messages.

ALWAYS
- Read the sources of truth above before evaluating or writing.
- Mark resume edits in red against the preserved black master text.
- Format company lines as `Company Name - Location | Dates` with the title line directly beneath, no blank line between them.
- Keep ATS keyword density natural. If a keyword would not appear in a human-written version of the bullet, leave it out.
- Log every evaluated role to the tracker, including skips, with the reason.
- Write in plain, direct English. Short sentences. No corporate filler (see `profile/resume-rules.md` for the banned list).
- Cite the exact master-resume line when claiming a match.

## Conventions

- Resume file names: `<First>_<Last>_Resume_[Company]` (add `_[Role]` when the company has more than one open role, add `_v2` etc. for revisions). The owner's name comes from `profile/profile.yml`.
- Report file names, when a report is written to the repo: `reports/YYYY-MM-DD-company-slug.md`.
- Dates: ISO `YYYY-MM-DD`. Timezone: the one in `profile/profile.yml`.
- Status values: exactly those in `rubric/states.yml`.
