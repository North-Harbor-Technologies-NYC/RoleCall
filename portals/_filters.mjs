// Shared zero-token filters: title filter from portals.yml, hard blockers from rubric/blockers.yml, relevance tiers.
// Used by portals/boards.mjs and portals/scan.mjs. No LLM involved.

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
export const config = yaml.load(readFileSync(path.join(here, 'portals.yml'), 'utf-8'));
const blockers = yaml.load(readFileSync(path.join(here, '..', 'rubric', 'blockers.yml'), 'utf-8'));
const hardRules = (blockers.hard || []).filter(r => Array.isArray(r.patterns));
const requireRules = hardRules.filter(r => Array.isArray(r.require_any_in));
const blockRules = hardRules.filter(r => Array.isArray(r.match_any_in));

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Positives match as whole words (so "AI" does not match "training"); negatives match as substrings.
const pos = (config.title_filter?.positive || []).map(s => new RegExp(`(?<![a-z0-9])${esc(s.toLowerCase())}(?![a-z0-9])`));
const neg = (config.title_filter?.negative || []).map(s => s.toLowerCase());

export function passesTitle(title) {
  const t = (title || '').toLowerCase();
  if (neg.some(n => t.includes(n))) return false;
  return pos.some(re => re.test(t));
}

// Returns the id of the first hard rule tripped, or null. Only simple pattern rules run here;
// multi-condition rules and description-based rules are left to the evaluator.
export function blockedBy(job) {
  for (const r of requireRules) {
    const hay = r.require_any_in.map(f => String(job[f] || '')).join(' | ').toLowerCase();
    if (!r.patterns.some(p => hay.includes(String(p).toLowerCase()))) return r.id;
  }
  for (const r of blockRules) {
    const fields = (r.match_any_in || []).filter(f => f !== 'description');
    const hay = fields.map(f => String(job[f] || '')).join(' | ').toLowerCase();
    if (r.patterns.some(p => hay.includes(String(p).toLowerCase()))) return r.id;
  }
  return null;
}

// Relevance tier for scoring order (1 = score first). Mirrors the tiers in .claude/skills/jobops-evaluate.
const TIER1 = ['post-production','post production','content operations','content ops','media operations','media ops','production operations','studio','creative operations','creative ops','video','multimedia','programming','head of content','vp, content','vp content','broadcast','localization','dubbing','production technology','content supply','ai content','ai creative','generative','ai transformation','applied ai','head of ai','vp, ai','vp ai','head of production','vp, production','vp production','director, production','director of production','executive producer'];
const TIER2 = ['media','entertainment','creative','brand partnerships','content','partnerships','enterprise account','strategic account','account executive','solutions'];
export function tierOf(title) {
  const t = (title || '').toLowerCase();
  if (TIER1.some(k => t.includes(k))) return 1;
  if (TIER2.some(k => t.includes(k))) return 2;
  return 3;
}
