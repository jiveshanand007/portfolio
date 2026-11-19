# Résumé versions

Jivesh's LaTeX résumés, newest last, as the source of truth for what the website says.

- One file per version: `versions/YYYY-MM-DD-<label>.tex` (the date the version was written).
- Never edit an old version; add a new file instead.
- `versions/` is **git-ignored**: these files contain a phone number and personal email, and this
  repository is public. They exist only on this machine. Back them up elsewhere if needed.

## Updating the website from a résumé

The site does not read these files directly. When asked to update the site from a version,
carry its facts into the site's own content:

| Résumé part | Where it goes on the site |
|---|---|
| Name, role, employer, location, email, links | `content/site.json` (top level) |
| Summary, skills, achievements, stats | `content/about.mdx` |
| Skills scene (grouped as techniques) | `content/site.json` → `scenes.skills.techniques[].skills` |
| Experience bullets | `content/experience/*.mdx` (prose only: no employer code) and `content/site.json` → `scenes.experience.achievements` |
| Projects | `content/projects/*.mdx` |
| Education | `content/experience/dtu-education.mdx` (no CGPA on the site, by request) |

Never put the phone number on the site. Facts the owner added beyond a résumé (for example
Kubernetes, and that the refund reconciliation runs on Apache Flink) stay unless a newer
version contradicts them.

## Versions

| File | Notes |
|---|---|
| `versions/2026-07-27-senior-sde2.tex` | Simplified-language pass for Senior SDE2 applications. The site's content was first built from this version. |
