# Tracker

The tracker is the RoleCall dashboard: a Postgres database on Neon behind the dashboard URL in ROLECALL_URL, table `jobs`. This file records its schema so every session and routine writes the same columns. The routine writes through `scripts/rolecall.mjs` (`jobs` to upsert rows, `apply` to read Apply rows, `known` to read every row for dedupe and the digest); the owner edits their columns in the dashboard. The source is `dashboard/lib/db.ts`.


## Columns (v2, 2026-10-21)

| Column | Type | Written by | Notes |
|---|---|---|---|
| id | text | routine | `YYYY-MM-DD-company-slug`; the primary key, upserts match on it |
| date_found | date | routine | |
| company | text | routine | |
| role | text | routine | |
| url | url | routine | Canonical posting on the company ATS or careers site, never the alert link |
| alert_url | url | routine | The link from the alert email, kept for audit |
| resolution | text | routine | resolved, expired, paywalled, unresolved (see portals/feeds.yml) |
| source | text | routine | `gmail:linkedin`, `gmail:builtin`, `ats:ashby`, `forward`, `manual` |
| archetype | text | routine | From rubric Step 0 |
| score | number | routine | One decimal |
| legitimacy | text | routine | High Confidence, Proceed with Caution, Suspicious |
| status | text | both | Exactly one of `rubric/states.yml`: Evaluated, Applied, Responded, Interview, Offer, Rejected, Discarded, SKIP |
| action | text | owner | Blank, `Apply`, `Skip`, `Hold`. The routine acts on `Apply` and clears it |
| resume_review | url | routine | Drive link to the tailored Google Doc with changes in red |
| resume_submit | url | routine | Drive link to the all-black submission copy, exported to PDF |
| report | url | routine | Repo path or Drive link to the A-G report, when one exists |
| applied_date | date | owner or routine | |
| last_touch | date | both | Last outbound contact |
| next_followup | date | routine | From the cadence rules |
| contact | text | owner | Recruiter or hiring manager |
| reason | text | routine | One line: why this score, or why SKIP |
| notes | text | owner | |
| location | text | routine | From the posting |
| comp | text | routine | Posted range as text, or "not stated" |
| tier | int | routine | 1 to 3, relevance tier from the feed or by title |
| score_breakdown | text | routine | The A-G dimension scores |
| jd | text | routine | Captured JD text |
| flags | json | routine | Soft-rule ids that fired |
| fit | text | routine | Why it fits, second person, for the Today screen (added 2026-10-29) |
| watch | text | routine | Worth knowing: what held the score back (added 2026-10-29) |
| checks | json | both | `[{text, done}]`; the routine writes the items for 4.0+ rows, the owner ticks them (added 2026-10-29) |

## Follow-up cadence (ported from legacy/followup-cadence.mjs)

- Applied, no response: first follow-up at 7 days (default, overridable), then every 7 days, maximum 2 follow-ups.
- Responded: reply within 1 day; follow up at 3 days if silent.
- Interview: thank-you within 1 day.
