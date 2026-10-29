---
name: jobops-outreach
description: For a role the owner is applying to, finds the likely hiring manager and the recruiter, drafts a short outreach note in the owner's voice, and posts contacts to the RoleCall dashboard. Runs after jobops-resume. Never sends anything.
---

# jobops-outreach

Read `CLAUDE.md`, `profile/positioning.md` (exit narrative, cross-cutting advantage), the role's report if one exists, and the dashboard row (`node scripts/rolecall.mjs apply` returns it in full).

## Why this exists

At VP and SVP level the application portal is the backup path. The primary path is a person. This skill makes sure every application has a named person attached before the owner submits.

## Find the people (web search, cap 5 minutes per role)

1. **Hiring manager.** The role's likely boss: for "VP, Content Operations" look for the SVP or EVP of Content, Production, or Operations at the company, or the GM of the division named in the JD. Search `"<company>" "<likely boss title>" site:linkedin.com/in` and the company's leadership page. Record name, title, LinkedIn URL, and the one-line reason this is the likely manager. If uncertain between two, record both and say so.
2. **Recruiter.** Search `"<company>" recruiter OR "talent acquisition" "<function>" site:linkedin.com/in`, and check whether the posting names a recruiter. Record the same fields.
3. **Warm paths.** Check `profile/positioning.md` and the master resume for an existing relationship at the company. If one exists, say who and suggest the intro route instead of cold outreach.

Do not guess email addresses. Do not record personal phone numbers or home locations. LinkedIn URLs and company titles only.

## Draft the note

One note per person, 90 to 130 words, plain text, no subject line unless it is email. Structure:
- One sentence naming the role and that the owner applied (or is about to).
- Two sentences on the single most relevant proof point for this person's problem, drawn from the report's Block B, with a number in it.
- One sentence that shows the owner knows something specific about the company's current situation (from Block D or G research: a launch, a reorg, a merger, a stated priority).
- One-line ask: 15 minutes, or a pointer to the right person.

Voice: direct, no flattery, no "I'm passionate about." Follow the banned list in `profile/resume-rules.md`. No em dashes. Never include the owner's phone number.

## Record

Dashboard: write `runs/YYYY-MM-DD/outreach/<slug>.rolecall.json` as `{"job_id": "<row id>", "contacts": [{"name", "title", "channel": "linkedin" or "email", "url": "<LinkedIn URL>", "draft": "<the note>"}]}` and run `node scripts/rolecall.mjs contacts <that file>`; then post `next_followup` (today plus 7 days) through `node scripts/rolecall.mjs jobs` with `{"jobs":[{"id", "next_followup"}]}`. Save the drafts to `runs/YYYY-MM-DD/outreach/<slug>.md`. Include them in the digest under the role.

## Follow-up cadence (used by the digest)

- Note sent, no reply: one follow-up at 7 days, a second at 14, then stop.
- Reply received: respond within one day; the digest flags any reply in the Gmail inbox from a recorded contact.
- Interview scheduled: thank-you note within one day of the interview.
