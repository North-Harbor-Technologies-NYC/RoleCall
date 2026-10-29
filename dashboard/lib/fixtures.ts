// Sample data for RC_FIXTURES=1: local screenshots, the public demo, and a first run before any routine has posted.
// Shapes match the tables in lib/db.ts. Nothing here is a real posting.
import type { Job } from '@/lib/db';

const today = new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const base = (o: Partial<Job> & Pick<Job, 'id' | 'company' | 'role'>): Job => ({
  date_found: today, url: 'https://example.com/jobs/' + o.id, alert_url: null, source: 'gmail:linkedin', location: 'New York, NY', comp: null, tier: 1,
  archetype: 'Head of Content Operations', score: null, score_breakdown: null, legitimacy: 'not assessed', resolution: 'resolved', status: 'Evaluated', action: '',
  resume_review: null, resume_submit: null, report: null, applied_date: null, last_touch: null, next_followup: null, contact: null, reason: null, notes: null, jd: null,
  flags: [], created_at: today, updated_at: today, fit: null, watch: null, checks: null, ...o,
});

export const JOBS: Job[] = [
  base({ id: `${today}-gartner-vp-creative-strategy`, company: 'Gartner', role: 'VP, Creative Strategy', location: 'Stamford, CT (hybrid)', comp: '$164,000 - $226,000 plus bonus', score: 4.1, report: `reports/${today}-gartner.md`,
    fit: "You would run Gartner's video, design, and brand teams, with a Head of Video Production reporting to you and a mandate to pilot AI in production, close to your last operation.",
    watch: 'Half the job is corporate brand stewardship, and the office is in Stamford.',
    checks: [{ text: "It asks for a bachelor's in design or similar; the master has no education line", done: false }, { text: 'The 2019 months need confirming', done: false }, { text: 'Four new stories have placeholders', done: false }] }),
  base({ id: `${today}-vox-media-vp-head-of-podcast-gtm`, company: 'Vox Media', role: 'VP, Head of Podcast Go-To-Market', comp: '$175,000 - $250,000', score: 3.6, source: 'scan:greenhouse', tier: 1,
    reason: 'A NYC VP role running podcast ad partnerships and creative strategy, where your talent and creator deal work counts. Held back because you have not led ad sales.' }),
  base({ id: `${today}-openai-account-director-digital-native`, company: 'OpenAI', role: 'Account Director, Digital Native Enterprise', location: 'New York, NY (hybrid 3 days)', comp: '$234,900 - $290,000', score: 3.6, source: 'scan:ashby', tier: 2,
    reason: 'Pay, location, and AI fit are strong. Held back because it asks for 8+ years of SaaS quota sales into tech companies, a buyer your streamer network does not reach.' }),
  base({ id: `${daysAgo(1)}-monks-vp-media-transformation`, company: 'Monks', role: 'VP, Media Transformation, North America', date_found: daysAgo(1), location: 'New York, NY (hybrid, RTO days not stated)', comp: '$215,000 - $245,000', score: 3.5, tier: 2, action: 'Hold',
    reason: 'Runs a 35+ person media transformation consultancy with P&L at $215K to $245K in NYC; held to 3.5 by the ad tech stack it requires (GMP, CM360, Amazon DSP) that the master does not show.' }),
  base({ id: `${daysAgo(2)}-morning-brew-vp-multimedia`, company: 'Morning Brew', role: 'VP, Multimedia', date_found: daysAgo(2), comp: '$200,000 - $240,000', score: 4.1, action: 'Apply', resume_review: 'https://docs.google.com/document/d/example', resume_submit: 'runs/x/resume/x.pdf', report: 'reports/x.md', next_followup: daysAgo(3),
    reason: 'Owns video, audio, and live across the brand with a 40-person team; the scale and the creator work both land.' }),
  base({ id: `${daysAgo(9)}-wbd-vp-content-ai`, company: 'Warner Bros. Discovery', role: 'VP Content AI', date_found: daysAgo(9), status: 'Applied', score: 4.3, resume_review: 'https://docs.google.com/document/d/example2' }),
  base({ id: `${daysAgo(12)}-pimco-svp`, company: 'PIMCO', role: 'SVP, Creative Production', date_found: daysAgo(12), status: 'Applied', score: 3.8 }),
  base({ id: `${daysAgo(14)}-dazn-vp`, company: 'DAZN', role: 'VP, Production Operations', date_found: daysAgo(14), status: 'Applied', score: 3.9 }),
  base({ id: `${daysAgo(20)}-meta-vp-content`, company: 'Meta', role: 'VP Content', date_found: daysAgo(20), status: 'Applied', applied_date: daysAgo(20), last_touch: daysAgo(20), next_followup: daysAgo(13), score: 4.0 }),
  base({ id: `${daysAgo(30)}-cnn-vp-ai`, company: 'CNN', role: 'VP AI', date_found: daysAgo(30), status: 'Responded', applied_date: daysAgo(30), last_touch: daysAgo(5), next_followup: daysAgo(-2), score: 4.2, contact: 'Jane Doe, VP Talent' }),
  base({ id: `${daysAgo(40)}-edelman-evp`, company: 'Edelman', role: 'EVP, Production', date_found: daysAgo(40), status: 'Interview', applied_date: daysAgo(40), last_touch: daysAgo(2), score: 4.0 }),
  base({ id: `${today}-nba-vp-cyber`, company: 'NBA', role: 'VP, Cybersecurity Operations & Architecture', status: 'SKIP', score: 3.0, tier: 3, location: 'Secaucus, NJ (4 days in office)', reason: 'Security leadership, a function outside the master; 4 days in Secaucus.' }),
  base({ id: `${today}-merck-ed-transformation`, company: 'Merck', role: 'Executive Director, Digital Transformation & Delivery Excellence', status: 'SKIP', score: 3.3, tier: 3, location: 'Rahway, NJ (hybrid)', reason: 'Pharma delivery office; comp not stated; Rahway hybrid.' }),
  base({ id: `${today}-mrbeast-director-creative-dev`, company: 'MrBeast', role: 'Director of Creative Development', status: 'SKIP', score: 2.5, tier: 2, location: 'Greenville, NC', reason: 'Five days in Greenville, NC, below the pay floor.' }),
  base({ id: `${today}-nyt-director-commerce`, company: 'The New York Times', role: 'Director, Commerce Partnerships (Temp)', status: 'SKIP', score: 2.5, tier: 1, reason: 'Temporary; commerce partnerships, not content operations.' }),
  base({ id: `${daysAgo(3)}-aandE-director-applied-ai`, company: 'Example Networks', role: 'Director Applied AI & Strategy', date_found: daysAgo(3), status: 'Evaluated', action: 'Skip', score: 3.7, reason: 'Director level under the old group; a conversation, not an application.' }),
];

export const RUNS = [0, 1, 2, 5, 6, 7].map((d, i) => {
  const day = daysAgo(d);
  const scored = [30, 30, 22, 30, 28, 30][i], kept = [1, 2, 1, 1, 1, 1][i], maybe = [2, 2, 0, 2, 1, 2][i];
  return {
    run_date: day, started_at: `${day}T15:36:00Z`, finished_at: `${day}T${['16:10', '16:13', '16:02', '16:08', '16:07', '16:15'][i]}:00Z`,
    summary: { run_date: day, window: { threads_in_window: 16 }, gmail: { listings_extracted: 69, new_candidates: 4, threads: new Array(16).fill('x') }, feed: { counts: { sources: 71, ok: 71, failed: 0, raw: 10167, passed: 582, new: [58, 71, 40, 62, 55, 66][i] }, errors: [] }, evaluate: { scored, at_or_above_4: kept, optional: maybe, unverified: 4, blocked_after_jd: 2 } },
    digest: i === 0 ? {
      date: day, headline: 'One recommended apply today and two optional roles. Nothing to follow up, nothing on the calendar.',
      top: [{ company: 'Gartner', role: 'VP, Creative Strategy', score: 4.1, source: 'gmail:linkedin' }],
      optional: [{ company: 'Vox Media', role: 'VP, Head of Podcast Go-To-Market', score: 3.6, source: 'scan:greenhouse' }, { company: 'OpenAI', role: 'Account Director, Digital Native Enterprise', score: 3.6, source: 'scan:ashby' }],
      could_not_verify: [
        { company: 'Ladders', role: 'SVP, Partnerships', resolution: 'unresolved', tried: 'Ladders Lever board (3 unrelated roles), theladders.com/careers 403, LinkedIn 429, web search. May be a client role posted under Ladders’ name.' },
        { company: 'Jefferies', role: 'SVP, Head of Enterprise AI Program Management', resolution: 'paywalled', tried: 'Jefferies careers site, no company posting found; scored 3.3 from the LinkedIn copy (bank AI program office), SKIP either way.' },
      ],
      failures: [], system: ['No connector failures. Gmail, Drive, and Calendar worked; 71 of 71 feed sources returned no errors.', 'Scrub: 13 of 16 companies covered. Not covered: Hearst, Formula 1, Hello Sunshine.', 'Lensa produced nothing at your level again: 1 of 40 listings passed. Worth deciding on unsubscribing.'],
    } : null,
  };
});

export const FEED = [
  ['Gartner', 'VP, Creative Strategy', 'Stamford, CT', 1, true, 4.1], ['Vox Media', 'VP, Head of Podcast Go-To-Market', 'New York, NY', 1, true, 3.6], ['OpenAI', 'Account Director, Digital Native Enterprise', 'New York, NY', 2, true, 3.6],
  ['Tubi (Fox)', 'Director, Creator Growth', 'New York or Los Angeles', 1, true, 3.4], ['The New York Times', 'Director, Commerce Partnerships (Temp)', 'New York, NY', 1, true, 2.5], ['MrBeast', 'Director of Creative Development', 'Greenville, NC', 2, true, 2.5],
  ['Conde Nast', 'Senior Director of Photography, The New Yorker', 'New York, NY', 3, true, null], ['Penske Media', 'Golden Globes: VP, Events Production', 'Los Angeles, CA', 3, true, null],
  ['Spotify', 'Head of Video Production', 'New York, NY', 1, false, null], ['Roku', 'Director, Content Operations', 'New York, NY', 2, false, null],
].map(([company, title, location, tier, is_new, score], i) => ({ id: `feed-${i}`, company, title, location, url: `https://example.com/feed/${i}`, posted: '', source: 'scan:greenhouse', provider: 'greenhouse', tier, first_seen: today, last_seen: today, is_new, data: {}, job_id: score !== null ? `job-${i}` : null, job_score: score, job_status: score !== null ? (Number(score) >= 3.5 ? 'Evaluated' : 'SKIP') : null }));
