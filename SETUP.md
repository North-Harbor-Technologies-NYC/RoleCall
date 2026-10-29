# Setting up RoleCall

Eight steps. Nothing here needs a terminal except the first two commands in step 1, and you can do those in GitHub's web editor instead.

You need: a Claude Pro or Max subscription, a GitHub account, a Vercel account (free), a Google account for the job-alert email and the resumes.

## 1. Your own copy of this repo

Create a **private** fork (or use "Use this template" and make the new repo private). Your profile, your resume, and every role you evaluate will live in it.

Clone it and install the two small dependencies the feed uses:

```
git clone https://github.com/<you>/rolecall
cd rolecall && npm install
```

## 2. Tell it who you are

Everything personal lives in `profile/`. Fill in, in this order:

1. `profile/profile.yml`: name, email, location, target roles, pay floor and target, the Gmail label names. The routine reads the owner's name and email from here.
2. `profile/resume-master.md`: paste your current resume as text, in the layout shown. The routine tailors from this and never adds a fact that is not in it. Keep the .docx or Google Doc you actually send as the canonical file; this is the copy the model reads.
3. `profile/positioning.md`: your target archetypes (three to five), what to lead with for each, your exit narrative in two or three sentences, your location rules, and the questions an interviewer will ask that need a prepared answer.
4. `profile/resume-rules.md`: read it. Change the section order and the file-name pattern to match your resume. The writing rules are the point of the system; keep them.
5. `profile/story-bank.md`: leave the examples or replace them. The evaluate skill appends to it over time.

Then the two config files that decide what gets through:

6. `rubric/blockers.yml`: the hard filters. The file ships with the rules for a New York, director-and-above, media and AI search. Edit the seniority list, the pay floor, the location rules (search for `home metro`), and the function blockers to fit your search.
7. `portals/portals.yml` and `portals/scan-targets.yml`: the title filter and the companies the feed scans. The shipped lists are media, entertainment, sports, and AI companies. Add yours; the provider notes in `portals/scrub-notes.md` show how to find a company's ATS.

Test the feed locally before anything else:

```
node portals/scan.mjs --dry | head -60
```

## 3. Gmail

Make two labels in Gmail: one for inbound alerts (the shipped name is `Jobs/Inbox`) and one the routine applies when it has processed a thread (`Jobs/Processed`). Set up a filter so your LinkedIn and other alert emails get the inbox label. Put the two label names in `profile/profile.yml`.

LinkedIn saved-search alerts are the best feed. Ladders, Lensa, and Indeed are mostly noise and the filters handle them; `portals/feeds.yml` says what the routine expects from each sender.

## 4. The dashboard

1. In Vercel, **Add New Project**, import your fork, set **Root Directory** to `dashboard`. Deploy; the first build will fail until the variables exist, that is fine.
2. **Storage tab**, add **Neon** (free). When it asks, leave "create a branch for each preview deployment" off.
3. **Settings, Environment Variables**. Add:
   - `AUTH_SECRET`: any random string of 32+ characters (`openssl rand -hex 32`).
   - `INGEST_TOKEN`: another random string. The routine and the Action use it to write.
   - `ALLOWED_EMAILS`: your email.
   - Sign-in, one of: `DASHBOARD_PASSWORD` (simplest; you sign in with your email and this password), or `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` from a Google OAuth client (Web application, redirect URI `https://<your-app>.vercel.app/api/auth/callback/google`).
   - `OWNER_FIRST_NAME`: for the greeting.
   - `SHOW_LICENSE=MIT` if you want the footer line; leave it out otherwise.
4. Redeploy. Open the site, sign in. Empty is correct at this point.

The full variable list is in `dashboard/README.md`.

## 5. The feed Action

In your GitHub repo, **Settings, Secrets and variables, Actions**, add two repository secrets: `ROLECALL_URL` (your Vercel URL, no trailing slash) and `ROLECALL_TOKEN` (the `INGEST_TOKEN` value). Then **Actions, feed, Run workflow**. In about a minute `feeds/latest.json` is committed and the dashboard's Feed page fills.

The schedule in `.github/workflows/feed.yml` is 14:45 UTC on weekdays. Move it to about 45 minutes before your routine time.

## 6. The routine

At [claude.ai/code/routines](https://claude.ai/code/routines), **New routine**:

- Repository: your fork.
- Schedule: daily, the time you want the email. The feed Action should run first.
- Model: **Sonnet** on a Pro plan; Opus if you are on Max and want sharper judgment on fit and writing.
- Connectors: Gmail, Google Drive, Google Calendar.
- Environment (the cloud icon under Instructions): Network access **Full**, and two variables, `ROLECALL_URL` and `ROLECALL_TOKEN`, same values as the Action secrets.
- Instructions: paste the text below the line in `routine/daily.md` after filling in the placeholders at the top.
- Turn on the API trigger and copy its URL and token into Vercel as `ROUTINE_FIRE_URL` and `ROUTINE_FIRE_TOKEN`; that is what "Apply and build resume" fires.

Run it once with **Run now** and the payload `SMOKE TEST`. You get an email saying whether the variables were present, how many rows the dashboard returned, and which connectors answered. Fix anything it reports, then let the schedule take over.

## 7. The first real run

The first run processes every unread alert in the label. If you have months of them, set the backlog date in `routine/daily.md` so older ones are marked read without processing. Expect 20 to 40 minutes on Sonnet. The email arrives at the end; the dashboard's Today page has the same roles with Apply, Hold, and Skip.

## 8. Every day after

Open Today. Decide. Apply builds the resume (a review copy with changes in red in your Drive, a submit copy as .docx and PDF) and drafts the outreach; you read both, submit the application yourself, and press "Mark applied". Pipeline tells you when to follow up.

## Keeping usage inside a Pro plan

- Sonnet for the routine.
- `daily cap` in `routine/daily.md` at 15. The feed's tiers make sure the best titles are scored first; the rest wait.
- Agentic scrub off (the `agentic:` list in `portals/scan-targets.yml` empty). Every company the feed can read costs nothing.
- Fewer alert senders. One good LinkedIn saved search beats five aggregators.

## Updating

Pull from this repo now and then. Your personal files are the ones in `profile/`, `data/`, `rubric/blockers.yml`, `portals/*.yml`, and `routine/daily.md`; nothing upstream touches them.
