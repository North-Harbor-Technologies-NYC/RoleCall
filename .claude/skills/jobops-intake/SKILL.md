---
name: jobops-intake
description: Daily intake for the owner's job search. Collects new roles from Gmail alert feeds, the zero-token feed in feeds/latest.json (boards plus career sites scanned by a GitHub Action), and a small agentic scrub of the sites the feed cannot read; dedupes against the tracker; runs hard blockers; resolves each survivor to its canonical live posting. Produces the candidate list the evaluate skill scores. Run before jobops-evaluate.
---

# jobops-intake

Read `CLAUDE.md`, `portals/feeds.yml`, `portals/portals.yml`, and `rubric/blockers.yml` first. The output of this skill is `runs/YYYY-MM-DD/candidates.json` plus a short intake summary used by the digest.

## 1. Window: unread, not time

The window is every job-alert email that is still unread, regardless of age. This is more robust than a time window: a failed run leaves its mail unread and the next run picks it up. Query Gmail with `is:unread` plus the feed senders in `portals/feeds.yml`; paginate until the result is empty.

Backlog policy: unread alerts dated before `gmail.backlog_before` in `profile/profile.yml` are not processed, however old they are. Mark them read and apply the processed label with no extraction, paginating until none remain, and count them in the summary. Do not stop to ask about scope. Everything from that date forward is processed in full, oldest first. Cap one run at 60 threads; leave the rest unread for the next run and say so in the summary.

Marking read happens in step 7, after rows are written. Never mark a thread read before its listings are in the tracker or in the blocked log.

## 2. Sources, in order

### 2a. Gmail feeds
Using the Gmail connector, search each feed in `portals/feeds.yml` with its senders and `is:unread`. Skip `ignore_senders`. Keep the list of thread ids you read; step 7 needs it. Read each matching thread in plain text. From each email extract every listing as `{company, title, location, salary_if_stated, alert_url, feed_id}`. One email can hold 10 to 30 listings; extract all of them, not the headline one.

### 2b. The feed (zero tokens)
Read `feeds/latest.json`. A GitHub Action (`.github/workflows/feed.yml`) runs `portals/scan.mjs` every weekday morning before this routine and commits the result: every Ashby, Greenhouse, and Lever board in `portals/portals.yml` plus the 35 or so career sites in `portals/scan-targets.yml` (Workday, SmartRecruiters, iCIMS, SuccessFactors, Oracle, UKG, Disney, Amazon, Netflix, Google, and others), already title-filtered, hard-blocked, deduped, and tiered. Each job carries `id`, `tier`, `posted`, `first_seen`, and `new` (not in the previous day's feed).

Use it like this:
- Check `generated_at`. If it is older than 30 hours, run `node portals/scan.mjs` yourself (about a minute, no tokens) and note in the summary that the Action did not run.
- Take jobs with `new: true` as today's candidates `{company, title, location, url, posted, source, tier}`. Jobs that are not new were already in a previous feed; they are candidates only if they are missing from the tracker and `data/` (step 3 dedupe decides), which happens after a failed run.
- Record `counts`, `errors`, and the list of failed sources for the summary; a failed source is one the agentic scrub (2c) should cover that day.

Do not run `portals/boards.mjs` separately; the feed includes the boards.

### 2c. Agentic scrub, only for what the feed cannot read
Read `portals/scrub-notes.md` and the `agentic:` list at the bottom of `portals/scan-targets.yml`. Scrub only: the companies in that `agentic` list, any source listed in the feed's `errors`, and nothing else. The feed replaces the per-company search-and-fetch that earlier runs did for Disney, NBCU, Netflix, Paramount, WBD, Amazon, the Workday tenants, the publishers, and the sports leagues; re-scrubbing them is wasted budget.
Method, cheapest first:
1. A known JSON endpoint or page from `scrub-notes.md`.
2. Headless Chromium: the cloud environment has Playwright preinstalled (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, do not run `playwright install`). Write a short Node script that opens the careers search URL, waits for network idle, and prints titles, locations, and links. If the site blocks headless browsers, say so in the summary rather than retrying.
3. Web search restricted to the careers host as a last resort.
Cap this at 90 seconds per company. When a method works reliably for a company, write it up in `runs/YYYY-MM-DD/scrub-notes-updates.md` as a candidate provider for `scan-targets.yml`; the owner ports it.

Extension rule: once a week (Mondays), spend up to 15 minutes finding companies that fit `profile/positioning.md` and are not in `portals.yml` or `scan-targets.yml` (companies that fit the owner's archetypes and location). Add candidates to `runs/YYYY-MM-DD/portal-suggestions.md` with the careers URL and a one-line reason. Do not edit `portals.yml` or `scan-targets.yml` directly; the owner approves additions.

### 2d. Forwards
Any email the owner forwarded to themself with a JD or a job URL in the window bypasses the title filter. Extract it as a candidate with `source: "forward"`.

## 3. Dedupe

Build the set of already-seen roles from: the RoleCall dashboard (`node scripts/rolecall.mjs known`, every row's id, company, role, url; report it in the digest's `failures` if it says the dashboard is not configured, since nothing else holds the full history), and `data/history.md`. Normalize titles by lowercasing, stripping punctuation, and removing level words in parentheses. A candidate matching an existing row is dropped, except that a role previously marked `expired` or `unresolved` may be re-tried once.

## 4. Hard blockers

Apply every `hard` rule in `rubric/blockers.yml` to title, location, and any description text already in hand. Keep a `blocked` list with the rule id for the summary. Apply the `title_filter` from `portals.yml` to everything except forwards.

## 5. Resolve to the canonical posting

For every survivor, follow the `resolution` steps in `portals/feeds.yml`:
- Feed results are canonical postings on the company's own board or site; mark `resolved` without refetching unless the evaluator needs the JD, which it does for every scored candidate (fetch the JD then).
- For email items: query the board API if the company has one; otherwise web search the exact title on the company's careers host; otherwise fetch the alert URL and look for an outbound link to the company site.
- Fetch the canonical page. It is `resolved` if it loads, the title matches, and there is an apply control or application form without "no longer accepting" or "position has been filled" text. It is `expired` if that text is present or the page 404s. It is `paywalled` if only an aggregator copy could be found. It is `unresolved` if nothing was found.
- Capture the JD text for resolved items (the evaluator needs it). Store it at `runs/YYYY-MM-DD/jd/<slug>.md`.
Cap resolution at 60 seconds per item.

## 6. Output

Write `runs/YYYY-MM-DD/candidates.json`: an array of `{id, company, title, location, url, alert_url, source, feed_id, resolution, salary_if_stated, jd_path, tier}` (tier per the relevance tiers in the evaluate skill; feed jobs carry it already). Write `runs/YYYY-MM-DD/summary.json` with: window start and end, counts per source, the feed's `generated_at` and `counts`, blocked counts per rule, resolution counts, companies scrubbed and companies skipped, feed errors.

Also write `runs/YYYY-MM-DD/passed.json`: every listing that passed the zero-token filters, from every source, with its resolution status. The digest prints this list in full as an appendix so nothing that passed is invisible, whether or not it was scored.

Resolved candidates go to `jobops-evaluate`. Expired, paywalled, and unresolved candidates go straight to the tracker as rows with `status: Discarded` (expired) or `status: Evaluated` with the resolution flag (paywalled, unresolved), and to the digest's "Could not verify" section with what was tried.

## 7. Mark processed (runs after jobops-evaluate has written the tracker rows)

For every Gmail thread read in step 2a whose listings are now either in the tracker or in the blocked log: add the processed label from `profile/profile.yml` and remove `UNREAD` with the Gmail connector's `label_thread` and `unlabel_thread`. Do the same for backlog threads (older than `gmail.backlog_before`) without processing them. If the tracker write failed, leave everything unread and report it.

## Do not

- Do not score anything here. Scoring is the evaluate skill's job.
- Do not spend tokens evaluating an item that tripped a hard blocker.
- Do not edit `portals.yml`, `scan-targets.yml`, `blockers.yml`, `feeds/`, or anything under `profile/`.
