---
name: jobops-evaluate
description: Scores resolved job candidates for the owner against the A-G rubric in rubric/evaluate.md, posts rows to the RoleCall dashboard, and writes full reports for roles at 4.0 and up. Takes runs/YYYY-MM-DD/candidates.json from jobops-intake, or a single pasted JD or URL in an interactive session.
---

# jobops-evaluate

Read `CLAUDE.md`, `profile/profile.yml`, `profile/positioning.md`, `profile/resume-master.md`, `rubric/evaluate.md`, and `data/tracker.md` first.

## Inputs

- Routine mode: `runs/YYYY-MM-DD/candidates.json` with `resolution: resolved`, each with a `jd_path`.
- Interactive mode: a pasted JD or URL. Run the intake resolution step on it first (resolve, liveness, JD capture), then continue here.

## Per candidate

1. Read the JD from `jd_path`.
2. Apply the multi-condition `hard` rules in `rubric/blockers.yml` that the feed scan cannot run because they need the JD: `onsite_west_coast` and `onsite_outside_home_metro` (`match_all_in` with `patterns_all`, and for the latter `location_none_of`, which means the rule trips only when the location names none of those places). A candidate that trips one is logged `SKIP` with the rule id and gets no score. Then apply the `soft` rules and note flags.
3. Run `rubric/evaluate.md` Step 0 and Block A on every candidate.
4. Run Blocks B, C, and the score on every candidate. Keep Block B tight: map only the requirements that matter, cite the master line for each.
5. Block D (comp and company research, two to three web searches) only for candidates whose provisional score after B and C is 3.5 or higher. Below that, mark Block D "not researched". The comp dimension always uses the posted range when the JD states one; it is 3 only when no range is posted.
6. Blocks E, F, and G only for candidates at 4.0 and up. Write the full report to `reports/YYYY-MM-DD-<company-slug>.md` using the format in `rubric/evaluate.md`. Append any new STAR+R stories to `profile/story-bank.md`.
7. Produce the tracker row (columns in `data/tracker.md`): id, date_found, company, role, url, alert_url, source, archetype, score, legitimacy (or "not assessed" below 4.0), resolution, status (`Evaluated`, or `SKIP` below 3.5), reason (one line, specific: the dimension that decided it), report path if written.

## Writing to the tracker

The tracker is the RoleCall dashboard (Postgres behind the URL in `ROLECALL_URL`). Nothing else is written.

Dashboard: write `runs/YYYY-MM-DD/rolecall-jobs.json` as `{"jobs": [...]}` with one object per evaluated candidate carrying the tracker columns plus `location`, `comp` (the posted range as text, or "not stated"), `tier`, `flags` (array of soft-rule ids), `jd` (the full captured JD text from `jd_path`), and, for every row at 3.5 or above, the three fields the dashboard's Today screen renders:

- `fit`: one to three sentences, second person, on why the role fits ("You would run..."). The strongest master-resume match first. No em dashes.
- `watch`: one or two sentences on what held the score back or what the owner should know before applying (office location, a requirement the master does not show, company stability). Plain statements, no hedging words.
- `checks`: an array of short strings, each one thing the owner must do or confirm before submitting (a requirement to address, a date to confirm, a placeholder in a story). Empty array when there is nothing. Only for rows at 4.0 and up; below that, omit the key.

`reason` stays as the one-line summary for the tracker. Do not restate `fit` and `watch` inside `reason`. Then run `node scripts/rolecall.mjs jobs runs/YYYY-MM-DD/rolecall-jobs.json`. It needs `ROLECALL_URL` and `ROLECALL_TOKEN` in the environment and skips with a note when they are missing; a non-zero exit means the post failed, report it in the digest's `failures`. The endpoint upserts by `id` and never overwrites the owner's columns (status after creation, action, dates, contact, notes); `checks` is written only when the row has none yet, so the owner's ticks survive a re-post.


## Order and budget

Score in relevance order so the daily cap goes to the best candidates. The feed (`feeds/latest.json`, built by `portals/scan.mjs`) already tags its jobs with `tier` (1, 2, 3). Apply the same tiers to email and scrub candidates by title:
- Tier 1: post-production, content or media or production operations, studio, creative operations, video, multimedia, programming, head of content, broadcast, localization, dubbing, production technology, content supply chain, AI content or creative, generative, AI transformation, applied AI, head of AI, head or VP of production, executive producer.
- Tier 2: media, entertainment, creative, brand partnerships, content, partnerships, enterprise or strategic account executive, solutions.
- Tier 3: everything else that passed the filters.

Score all tier 1, then tier 2, then tier 3, stopping at 30 candidates in a routine run. Leave the rest in `runs/YYYY-MM-DD/deferred.json` with their tier. A tier 3 candidate deferred twice is logged to the tracker as `SKIP` with reason "not scored: low relevance after two runs" and dropped, so junk cannot block the queue. Interactive runs have no cap.

## Output

`runs/YYYY-MM-DD/evaluated.json`: array of tracker rows plus `score_breakdown` per candidate. The digest reads this file.

## Rules

- Every number in a score comes from the rubric weights; show the breakdown.
- Say "not stated" for comp when the JD has no range. Never estimate a range as if posted.
- A relationship at the company is worth at most +0.2. Say which relationship.
- The red-flag questions listed in `profile/positioning.md` are known; prepare answers in Block F, do not treat them as gaps in Block B.
