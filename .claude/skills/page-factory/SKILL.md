---
name: page-factory
description: Build a new page or add a new section on the IncubXperts website from a reference URL (layout) plus custom content (live incubxperts.com, Strapi, or typed text), asking the intake questions first, then measuring SEO/performance before and after and writing (and optionally posting) a before/after report. Use for any request to create, add or generate a page or section for the website, e.g. "add a services page like https://…", "add a how-we-work section to careers", "build this page from our live content".
argument-hint: [page|section] [reference-url] [target page or slug]
---

# /page-factory — intake, build, measure, report

You run the page factory's ordered pipeline (`npm run factory -- run`) as a conversation:
**ask → brief → run → generate the draft → resume → review the report → (optional) PR comment.**
People guide: `docs/PAGE-FACTORY.md`. Arguments: `$ARGUMENTS` (use them to pre-fill answers).

## Hard rules (the tool also enforces most of them)
1. **Layout only from the reference.** Never reuse its text, images, logos, icons, brand elements or code. Our colours and fonts come from the theme.
2. **No invented content.** Every sentence, number, claim, name and image comes from the supplied content. Omit a section the content cannot support and say so. The grounding check flags what it cannot trace; fix or delete each flagged item.
3. **Client confidentiality.** Case studies stay anonymized; never use a Strapi internal-name field; CMS images are copied locally with neutral names automatically. Never put a client name in alt text.
4. **Only existing blocks and props** (`src/blocks/schema.ts` is strict; `src/blocks/catalog.ts` says when to use each). If nothing fits, follow "New block or variant" in `/new-page`.
5. **Never bypass site protections.** If the reference blocks automated browsers, retry with `--headed` (a normal visible Chrome window). If it still blocks or shows a challenge, stop and tell the user. No user-agent spoofing, no solving challenges.
6. **Secrets**: for `strapi:` content the user puts `STRAPI_URL` and a read-only `STRAPI_TOKEN` in `.env.local`; never ask them to paste it into chat. For the automatic engine, `ANTHROPIC_API_KEY` goes in `.env.local` too.
7. **Do not push or open pull requests unless asked.** Work on a branch (`feature/page-<slug>` or `feature/section-<page>-<name>`). When asked to push, push to BOTH remotes (`origin` GitLab and `github`; GitHub is the source of truth), fast-forward only.

## Step 1 — Intake (ask, don't guess)
Look first: `ls src/content/pages`; for a section, read `src/content/pages/<page>.json` and list its blocks (type + heading).
Use the AskUserQuestion tool for choices (max 4 questions per call, so two rounds) and plain chat for free text. Collect:

| Need | How to ask |
|---|---|
| New **page** or new **section** on an existing page | choice |
| Page mode: slug (lowercase-with-hyphens), title, header-nav label (optional) | free text |
| Section mode: which page; **after/before which section** (offer the page's real headings) | choice from the page's blocks |
| **Reference URL** (the layout to follow); section mode: **which section of it** (its heading) | free text |
| **Content sources** (one or more): `live:<url>[#Heading]`, `strapi:<collection>[?limit=3]`, `file:<path>`, or text the user types now (save it to `.factory/briefs/<name>.md` and use `file:`) | free text; explain each source |
| **Images**: use the ones in the content / the user's own files (need path + a description for alt text) / none | choice |
| **Notes**: tone, emphasis, what to avoid | free text, optional |
| Measure SEO/performance before and after? (default yes; it adds about 5 minutes) and post the report on the pull request? (default yes if a PR exists) | choice |

Write the answers to `.factory/briefs/<slug-or-page>.json` (shape = `briefSchema` in `scripts/factory/pipeline.mts`; the tool rejects invalid briefs with readable errors):
```json
{ "mode": "section", "page": "careers", "insert": { "after": "Why join" },
  "reference": { "url": "https://…", "section": "How we work" },
  "content": ["live:https://incubxperts.com/about-us#Leadership"],
  "images": { "mode": "content" }, "notes": "…",
  "measure": { "enabled": true, "runs": 3, "port": 3199 }, "publish": { "prComment": true } }
```
Page mode uses `"slug"`, `"title"`, `"nav"` instead of `"page"`/`"insert"`. **Read the brief back to the user and get a yes before running.**

## Step 2 — Run the pipeline
```bash
npm run factory -- run --brief .factory/briefs/<name>.json --engine prompt
```
Tell the user it takes several minutes (two builds and six Lighthouse runs). The steps are: baseline measure → capture reference → read content → **generate** → apply → measure again → report → publish. Exit codes:

| Code | Meaning | What you do |
|---|---|---|
| 0 | finished | go to Step 5 |
| **10** | **paused: waiting for `draft.json`** | Step 3 |
| 3 | draft rejected; site untouched | fix `draft.json` per the printed errors, then Step 4 |
| 2 | reference blocked automated browsing | rerun with `--headed`, else stop and tell the user |
| 1 | error (message says which step) | fix the cause, then Step 4 (resume continues from that step) |

## Step 3 — Write the draft (this is the generation step)
Open `.factory/runs/<run>/prompt.md`, **view the screenshots listed at its top** (Read tool), then write `draft.json` in the run folder:
- section mode: `{ "blocks": [<1-2 Block>], "rationale": "…" }`; page mode: `{ "page": <PageDefinition>, "rationale": "…" }` (schema: `output.schema.json`).
- Map layouts to blocks as listed in the prompt; alternate `bg`; one hero first (page mode); page SEO title <= 60 chars, description 120-160, `reference` set; never a hero in a section.
- `rationale`: how you mapped each reference section, and what you omitted and why.
Write JSON with the Write tool, not shell heredocs or `node -e` (escape sequences get mangled).

## Step 4 — Resume
`npm run factory -- resume --run .factory/runs/<run> --engine prompt` (add `--headed` if needed). It validates, checks grounding, applies (rolled back on failure), rebuilds, measures again and writes `report.md`. If it exits 3, fix `draft.json` and resume again. Fix every item in the report's **Content integrity** list.

## Step 5 — Review with the user
Read `report.md` and summarise it **honestly**: scores before/after, page weight and DOM change, grounding result, anything marked ⚠️. Performance scores vary about ±8 points with machine load, so lean on page weight and script size. To judge the look: `npx next start -p 3100`, then `npm run factory -- capture http://localhost:3100/<page> --out .factory/ours` and view `.factory/ours/shots/*.jpg` beside the reference screenshots; check mobile. Stop the server afterwards. State structure match and visual match separately.

## Step 6 — Git and the report
Create the branch and commit. If the user asks to push: push to both remotes, open the pull request if asked, then post the report:
`npm run factory -- publish --run .factory/runs/<run> [--pr <number>]` (uses `gh`; GitHub only). Regenerate a report without re-measuring: `npm run factory -- report --run <run>`.
