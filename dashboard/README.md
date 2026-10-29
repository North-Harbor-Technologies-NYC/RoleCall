# RoleCall dashboard

Next.js app deployed on Vercel from the `dashboard/` folder of this repo. Postgres on Neon. Sign-in with Google (owner) or a shared password (friend's copy), restricted to `ALLOWED_EMAILS`.

Screens: **Today** (the roles to decide on, one match card at a time, keys `J`/`K`/`A`/`H`/`S`/`Enter`/`X`), **Pipeline** (everything acted on, filtered by stage, with the next step per row), **Feed** (every posting that passed the filters before scoring), **Runs** (one record per routine run, with a readable run day page), and a job page. Visual design per the 2026-10-29 handoff: warm paper, four semantic hues (fit, watch, in progress, needs you), Hanken Grotesk and JetBrains Mono, no shadows.

## Environment variables (Vercel project settings)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Set by the Neon integration in the Storage tab (any Neon or Vercel Postgres variable name is accepted) |
| `AUTH_SECRET` | Random 32+ bytes; signs sessions |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Google OAuth client (Web application) with redirect URI `https://<host>/api/auth/callback/google` |
| `DASHBOARD_PASSWORD` | Alternative to Google: one shared password (friend's copy) |
| `ALLOWED_EMAILS` | Comma-separated emails that may sign in; nobody gets in when empty |
| `INGEST_TOKEN` | Bearer token the routine and the GitHub Action use to write |
| `ROUTINE_FIRE_URL`, `ROUTINE_FIRE_TOKEN` | The routine's API trigger, for "Apply and build resume" (optional; without them Apply queues the build for the next run) |
| `REPO_URL` | GitHub URL used to link reports (default: this repo) |
| `OWNER_FIRST_NAME` | Name in the Today greeting (default: the signed-in user's first name) |
| `RUN_TIME_LABEL` | When the routine runs, for copy such as "The next run is tomorrow at 11:30 AM ET" (default `11:30 AM ET`) |
| `SHOW_LICENSE` | Set to `MIT` on an open-source deployment to show "Open source under MIT" on the sign-in page; leave unset on a private instance |
| `RC_FIXTURES` | `1` serves the sample data in `lib/fixtures.ts` instead of the database (local screenshots, demos) |

## API

- `POST /api/ingest/jobs` `{jobs:[...]}` upsert tracker rows (bearer). Routine columns only; never overwrites the owner's columns. Rows may carry `fit`, `watch`, and `checks` (`["text", ...]` or `[{text, done}]`); `checks` is written only when the row has none yet.
- `GET /api/ingest/jobs?action=Apply` rows to act on (bearer); without `action`, every row with id, company, role, url, status, action, score, and the date and contact columns.
- `POST /api/ingest/runs` one record per run (bearer).
- `POST /api/ingest/feed` body of `feeds/latest.json` (bearer; the Action calls it).
- `PATCH /api/jobs/:id` the owner's columns, including `checks` (session).
- `POST /api/jobs/:id/build-resume` sets Apply and fires the routine (session).

The schema is created on first request (`lib/db.ts`), so a fresh database needs no migration; new columns are added with `alter table ... add column if not exists`.

## Local preview

```
cd dashboard && npm ci
RC_FIXTURES=1 DASHBOARD_PASSWORD=preview ALLOWED_EMAILS=you@example.com AUTH_SECRET=$(openssl rand -hex 32) npm run dev
```

Sign in with the email and password above. No database needed.

## Deployments

Only `main` deploys. `vercel.json` turns off automatic deployments for every `claude/**` branch (the routine pushes one per day for its run artifacts), and the ignore command skips any other preview that does not touch `dashboard/`. Keep the Neon integration's "create a branch for each preview deployment" option off: the free plan allows 10 database branches and each preview would consume one before the build step runs.
