# Evaluation rubric (A-G)

Structure ported from career-ops `modes/oferta.md` and `modes/_shared.md`, adapted for a pipeline where hard filters have already run and the owner's archetypes live in `profile/positioning.md`. Apply only to roles that passed `rubric/blockers.yml`.

Before scoring, read `profile/profile.yml`, `profile/positioning.md`, `profile/resume-master.md`, and check `data/` so an already-evaluated role is not scored twice.

## Step 0: archetype

Classify into one of the archetypes in `profile/positioning.md` (primary, secondary, or adjacent). Hybrids name the two closest.

The archetype decides which proof points lead in Block B, how the PROFILE paragraph is rewritten in Block E, and which STAR+R stories are prepared in Block F.

## Block A: role summary

Table: archetype, domain, function, seniority, location and attendance policy, team size if stated, reporting line if stated, comp if stated, source (ATS, company site, alert, forward), one-sentence TL;DR.

## Block B: match with the master resume

Map each JD requirement to the exact master-resume line that answers it. Then list gaps. For each gap: hard blocker or nice-to-have, adjacent experience that covers it, and a one-line mitigation.

Lead with the proof points the "Lead with, by archetype" table in `profile/positioning.md` names for this archetype.

## Block C: level and strategy

1. Level in the JD versus the owner's natural level for this archetype.
2. "Sell senior without lying" plan: which achievements to lead with, how any founder or consulting period reads as an advantage.
3. "If they downlevel" plan: accept only if comp is at or above the floor in `profile/profile.yml`, negotiate a six-month review with written promotion criteria.

## Block D: comp and demand

Web search for current comp for the role and company (Levels.fyi, Glassdoor, Blind, posted ranges), the company's comp reputation, and recent hiring or layoff news. Table with sources. If there is no data, say so.

## Block E: customization plan

Table of proposed resume changes, each with section, current text, proposed text, and why. Obey `profile/resume-rules.md`: at most the header, the PROFILE paragraph, bullet order, and up to three rewritten bullets per role. Everything traces to the master. Also list the top five LinkedIn changes.

## Block F: interview plan

Six to ten STAR+R stories mapped to JD requirements. Check `profile/story-bank.md` first and reuse; append new stories there. Include one recommended case study and the red-flag questions from `profile/positioning.md` with answers.

## Block G: posting legitimacy

Observations, not accusations. Signals: posting age, apply button state, specificity of the JD, realism of requirements, salary transparency, recent layoff news in the same department, reposting pattern against `data/`. Output one of: High Confidence, Proceed with Caution, Suspicious. Executive and niche roles stay open for months; adjust thresholds.

## Scoring

Eight weighted dimensions, each 1 to 5. Score = (sum of score x weight) / 16, then add the relationship bonus and subtract the red-flag penalty, rounded half up to one decimal. Show the breakdown.

| Dimension | Weight | Notes |
|---|---|---|
| Match with master resume | 3 | From Block B |
| Archetype fit | 3 | Primary 5, Secondary 3.5, Adjacent 2.5, adjusted by JD |
| Seniority fit | 2 | At the owner's level 5, one below 4, further below 2 |
| Comp vs floor and target | 2 | From the posted range when one exists, whether or not Block D ran: top of range below floor 1, at floor 3, within target 5. Unknown 3. Never from an aggregator estimate. |
| Location | 2 | Per the location rules in `profile/positioning.md` |
| Scope and operational dimension | 2 | Pure strategy or org-chart roles score low |
| Domain centrality | 1 | The owner's core domain is the work 5, a roadmap item 2, not relevant 3 |
| Company stability and stage | 1 | From Block D and G |
| Relationship bonus | n/a | Added after the weighted mean: +0.1 for a named contact, +0.2 for a direct relationship with the hiring team. Never more. |
| Red flags | n/a | Subtracted after the weighted mean: 0.1 per soft flag from blockers.yml, 0.2 for aggregator_source when the canonical posting could not be verified, cap 0.5 |

Interpretation:
- 4.5 and up: apply now. Draft the resume without waiting.
- 4.0 to 4.4: apply. Include in the digest as a recommended apply.
- 3.5 to 3.9: include in the digest as optional, with the specific reason it might be worth it.
- Below 3.5: log as SKIP with the reason. Do not surface in the digest except as a one-line count.

## Output

For the tracker, every evaluated role produces: date, company, role, URL, source, archetype, score, legitimacy tier, status (`Evaluated` or `SKIP`), one-line reason, resume link (empty until built), and for 3.5 and up the `fit`, `watch`, and `checks` fields the dashboard shows.

For the digest, roles at 3.5 and up produce a short card: company, role, score, location and policy, comp if known, the one sentence that explains the score, and the apply link.

A full A-G report is written only for roles at or above `routine.report_threshold` in `profile/profile.yml` (4.0 by default), to `reports/YYYY-MM-DD-company-slug.md`, so tokens are not spent writing interview plans for roles the owner will never pursue.
