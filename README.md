# RoleCall

Every morning the roles report in. RoleCall is a job-search system that runs on a Claude subscription: a daily Claude Code routine reads your job-alert email and a zero-token feed of career sites, filters and scores every role against your resume with a written rubric, builds a tailored resume for the ones you choose, drafts outreach to the hiring manager, and sends you a short email. A small dashboard on Vercel is where you decide.

It was built by Mike Gio at [North Harbor Technologies](https://northharbortech.com) for his own search and is shared under the MIT license. It is opinionated: director-and-above roles, a hard pay floor, a home metro, a master resume that never gets invented facts. Change the config, not the rules.

## What it costs

A Claude Pro or Max subscription, nothing else. GitHub Actions on a private repo (2,000 free minutes a month; the feed uses about 25), Vercel Hobby, Neon's free Postgres tier, and a Google OAuth client or a shared password for sign-in.

On a $20 Pro plan: run the routine on Sonnet, keep the daily scoring cap at 15, and leave the agentic career-site scrub off. The zero-token feed does the heavy reading in GitHub Actions, so the routine spends tokens only on judgment.

## How it works

```
10:45 AM  GitHub Action: portals/scan.mjs reads every board and career site in portals/,
          applies the title filter and hard blockers, commits feeds/latest.json,
          and posts it to the dashboard. No tokens.

11:30 AM  Claude Code routine, five skills in order:
          jobops-intake     unread alert email + the feed + dedupe + blockers + resolve each posting
          jobops-evaluate   A-G rubric, score, reports for 4.0+, rows to the dashboard
          jobops-resume     tailored resume for every row you marked Apply (red marks on the review copy)
          jobops-outreach   hiring manager and recruiter found, notes drafted, nothing sent
          jobops-digest     one email, built from a JSON spec by templates/build_digest.cjs

Any time  The dashboard: Today (decide), Pipeline (track), Feed (what passed the filters),
          Runs (what each run did). "Apply and build resume" fires the routine right away.
```

The system prepares. You submit. It never sends an application or a message on your behalf.

## Layout

```
CLAUDE.md                 rules every session and routine run follows
profile/                  you: identity, positioning, master resume, resume rules, story bank
rubric/                   blockers.yml (hard filters), evaluate.md (the A-G rubric), states.yml
portals/                  the feed: title filter, tracked boards, career-site targets, 17 ATS providers
.claude/skills/           the five routine skills
routine/daily.md          the routine prompt to paste at claude.ai/code/routines
templates/                build_resume_docx.cjs and build_digest.cjs (Claude writes JSON, the builders own layout)
scripts/rolecall.mjs      the dashboard client used by the skills and the Action
.github/workflows/feed.yml the daily zero-token scan
dashboard/                the Next.js app (see dashboard/README.md)
data/                     tracker schema and the list of roles you have already seen
```

## Setup

Follow [SETUP.md](SETUP.md). Budget an hour: fork, fill in `profile/`, deploy the dashboard, create the routine, connect Gmail and Drive.

## Provenance

The rubric structure, state machine, and the Ashby, Greenhouse, and Lever clients derive from [santifer/career-ops](https://github.com/santifer/career-ops) (MIT). Everything else is North Harbor Technologies, 2026, MIT. See NOTICE.
