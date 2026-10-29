# Skills

The routine skills live in `.claude/skills/` so a cloud routine picks them up from the clone. Run order and hand-offs:

| Skill | Reads | Writes |
|---|---|---|
| `jobops-intake` | Gmail feeds, `node portals/boards.mjs`, career-site scrub, tracker, `data/` | `runs/<date>/candidates.json`, `summary.json`, `jd/*.md` |
| `jobops-evaluate` | `candidates.json`, JDs, `rubric/`, `profile/` | tracker rows, `reports/*.md`, `runs/<date>/evaluated.json`, story bank |
| `jobops-resume` | tracker rows with action Apply, JD, `templates/resume.html` | two Google Docs per role, tracker links |
| `jobops-outreach` | tracker row, report | contacts in tracker, `runs/<date>/outreach/*.md` |
| `jobops-digest` | everything above, tracker, Gmail, Calendar | one email, `runs/<date>/digest.md`, commit on `claude/runs-<date>` |

The routine prompt that sequences them is `routine/daily.md`. In an interactive session, any skill can be invoked on its own (`/jobops-evaluate` with a pasted JD, `/jobops-resume` for a named company).
