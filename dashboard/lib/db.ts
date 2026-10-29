// Postgres on Neon over HTTP. One tagged-template query function; the schema is created lazily and idempotently
// so a fresh database works on first request without a migration step.
import { neon } from '@neondatabase/serverless';

// The Neon integration names the variable DATABASE_URL by default, but an integration prefix or an older
// Vercel Postgres setup gives POSTGRES_URL or <PREFIX>_DATABASE_URL. Take the first postgres URL we can find.
function findDatabaseUrl(): { name: string; url: string } | null {
  const preferred = ['DATABASE_URL', 'POSTGRES_URL', 'DATABASE_URL_UNPOOLED', 'POSTGRES_URL_NON_POOLING', 'POSTGRES_PRISMA_URL', 'NEON_DATABASE_URL'];
  for (const n of preferred) { const v = process.env[n]; if (v && /^postgres(ql)?:\/\//.test(v)) return { name: n, url: v }; }
  for (const [n, v] of Object.entries(process.env)) { if (v && /^postgres(ql)?:\/\//.test(v) && /(DATABASE|POSTGRES|PG)/.test(n)) return { name: n, url: v }; }
  return null;
}
export const dbSource = findDatabaseUrl();
export const sql = neon(dbSource?.url || 'postgres://invalid');

export const STATUSES = ['Evaluated', 'Applied', 'Responded', 'Interview', 'Offer', 'Rejected', 'Discarded', 'SKIP'] as const;
export const ACTIONS = ['', 'Apply', 'Skip', 'Hold'] as const;

let ready: Promise<void> | null = null;
export function ensureSchema() {
  if (!ready) ready = (async () => {
    await sql`create table if not exists jobs (
      id text primary key,
      date_found date,
      company text not null,
      role text not null,
      url text,
      alert_url text,
      source text,
      location text,
      comp text,
      tier int,
      archetype text,
      score numeric(3,1),
      score_breakdown text,
      legitimacy text,
      resolution text,
      status text not null default 'Evaluated',
      action text not null default '',
      resume_review text,
      resume_submit text,
      report text,
      applied_date date,
      last_touch date,
      next_followup date,
      contact text,
      reason text,
      notes text,
      jd text,
      flags jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
    // Added 2026-10-29 (dashboard redesign): the routine writes fit and watch text and a checklist per role.
    await sql`alter table jobs add column if not exists fit text`;
    await sql`alter table jobs add column if not exists watch text`;
    await sql`alter table jobs add column if not exists checks jsonb`;
    await sql`create index if not exists jobs_status_idx on jobs(status)`;
    await sql`create index if not exists jobs_date_idx on jobs(date_found desc)`;
    await sql`create table if not exists runs (
      run_date date primary key,
      started_at timestamptz,
      finished_at timestamptz,
      summary jsonb,
      digest jsonb,
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists feed (
      id text primary key,
      company text, title text, location text, url text, posted text,
      source text, provider text, tier int,
      first_seen date, last_seen date, is_new boolean default false,
      data jsonb
    )`;
    await sql`create index if not exists feed_seen_idx on feed(first_seen desc)`;
    await sql`create table if not exists contacts (
      id serial primary key,
      job_id text references jobs(id) on delete cascade,
      name text, title text, channel text, url text, draft text,
      status text default 'drafted',
      created_at timestamptz not null default now()
    )`;
    await sql`create table if not exists events (
      id serial primary key,
      job_id text,
      kind text not null,
      detail jsonb,
      actor text,
      created_at timestamptz not null default now()
    )`;
  })();
  return ready;
}

export type Job = {
  id: string; date_found: string | null; company: string; role: string; url: string | null; alert_url: string | null;
  source: string | null; location: string | null; comp: string | null; tier: number | null; archetype: string | null;
  score: string | number | null; score_breakdown: string | null; legitimacy: string | null; resolution: string | null;
  status: string; action: string; resume_review: string | null; resume_submit: string | null; report: string | null;
  applied_date: string | null; last_touch: string | null; next_followup: string | null; contact: string | null;
  reason: string | null; notes: string | null; jd: string | null; flags: unknown; created_at: string; updated_at: string;
  fit: string | null; watch: string | null; checks: unknown;
};

// Columns the routine may write. Everything else is the owner's.
export const ROUTINE_COLS = ['date_found', 'company', 'role', 'url', 'alert_url', 'source', 'location', 'comp', 'tier', 'archetype', 'score', 'score_breakdown', 'legitimacy', 'resolution', 'status', 'resume_review', 'resume_submit', 'report', 'next_followup', 'reason', 'jd', 'flags', 'fit', 'watch', 'checks'] as const;
// Columns the owner edits from the dashboard.
// `checks` is shared: the routine writes the items, the owner ticks them.
export const USER_COLS = ['status', 'action', 'applied_date', 'last_touch', 'next_followup', 'contact', 'notes', 'checks'] as const;
