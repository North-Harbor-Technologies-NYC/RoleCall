---
name: jobops-digest
description: Composes and sends the owner's daily job-search email from the day's intake, evaluation, resume, and outreach outputs plus the RoleCall dashboard, Gmail, and Calendar. Last step of the daily routine.
---

# jobops-digest

Read `CLAUDE.md`, `data/tracker.md`, `runs/YYYY-MM-DD/summary.json`, `runs/YYYY-MM-DD/evaluated.json`, any `runs/YYYY-MM-DD/outreach/*.md`, and the dashboard rows: `node scripts/rolecall.mjs known > runs/YYYY-MM-DD/known.json` (every row with id, company, role, url, status, action, score, date_found, applied_date, last_touch, next_followup, contact).

## Gather

1. **New matches**: rows from today's `evaluated.json` at 3.5 and up, sorted by score.
2. **Could not verify**: today's candidates with resolution `expired`, `paywalled`, or `unresolved`, each with what was tried (from the intake output).
3. **Resumes built today**: the resume skill's summaries and links.
4. **Follow-ups due**: rows in `known.json` where `next_followup` is today or earlier and status is Applied, Responded, or Interview. Also any Gmail thread in the last 24 hours from a contact recorded on a row, or whose subject mentions a company with status Applied or later.
5. **Interviews**: Google Calendar events in the next 48 hours whose title or attendees match a company in `known.json`. For each, a five-line prep: the role, the score and archetype, the two stories from `profile/story-bank.md` that fit, the one red-flag question most likely to come up, and the report link.
6. **Pipeline counts**: Applied, Responded, Interview, Offer totals from `known.json`, and how many are stale (Applied over 21 days with no touch).
7. **System notes**: board errors, companies the scrub could not cover, candidates deferred for tomorrow, portal suggestions (Mondays).

## Compose

The layout lives in `templates/build_digest.cjs`; the skill only writes data. Write `runs/YYYY-MM-DD/digest.json` with the fields documented at the top of that file (date, repo_url, branch, headline, top, optional, resumes, could_not_verify, followups, interviews, pipeline, failures, system, appendix, drafts), then run:

```
node templates/build_digest.cjs runs/YYYY-MM-DD/digest.json runs/YYYY-MM-DD/digest.html runs/YYYY-MM-DD/digest.txt
```

It prints the subject line (`Jobs <date>: <n> new matches, <m> to verify, <k> follow-ups`) and refuses em dashes. Never hand-write HTML; if the layout needs a change, change the builder in a session with the owner, not in a run.

Field rules:
- `top` is 4.0 and up, `optional` is 3.5 to 3.9, both sorted by score. Each role: `why` is one or two sentences on what decided the score; `note` (optional) is anything the owner must do before using the report, such as placeholders or unconfirmed dates; `apply_url` is the canonical posting, never the alert; `report` is the repo path (`reports/YYYY-MM-DD-slug.md`) and the builder turns it into a GitHub link on the run branch; `source` names the feed or board.
- `headline` is one sentence: what to do today.
- `failures` holds connector or step failures only; the builder prints them at the top. Everything else goes in `system`, one line each, and `system` stays under eight lines. Roles below 3.5 appear only as counts with the top three blocker reasons.
- `pipeline.note` carries the stale explanation and any Apply row waiting on the owner.
- `appendix.rows` is every new item from `passed.json` (scored first by score, then deferred by tier), with `url` when known; `appendix.new`, `carried`, and `duplicates` are counts. When `dashboard_url` is set, the builder prints a link instead of the table; until the dashboard exists, the table stays in the email.
- `drafts` holds outreach and follow-up drafts as `{title, text}`; they print at the very bottom.

The body above the appendix stays scannable: at most three recommended, three optional, and the could-not-verify list. If more than three roles score 3.5 or higher, the rest go in the appendix with their scores.

## Record the run

Write `runs/YYYY-MM-DD/run.json` as `{"run_date", "started_at", "finished_at", "summary": <summary.json>, "digest": <digest.json without appendix.rows>}` and run `node scripts/rolecall.mjs run runs/YYYY-MM-DD/run.json`. Set `dashboard_url` in `digest.json` to `the dashboard URL in ROLECALL_URL/feed` when `ROLECALL_URL` is set, so the email links to the feed instead of printing the appendix table.

## Send

Gmail connector, from the owner's account to the owner's email from profile/profile.yml, with `htmlBody` set to the contents of `digest.html` and `body` set to `digest.txt` (the plain-text alternative). Gmail rewrites links through google.com/url for messages the account sent to itself; that is display-side and the click still lands on the posting, so do not try to work around it. Label the sent message `Jobs/Digest` (create the label on first run). Commit the day's `runs/` folder (including `digest.json`, `digest.html`, `digest.txt`, and any `reports/` written today) to the repo on a branch named `claude/runs-YYYY-MM-DD` so the report links in the email resolve.

If there is nothing new and nothing due, still send: the builder produces the pipeline tiles and system card from an otherwise empty spec; set `headline` to "Quiet day: nothing new passed the filters."
