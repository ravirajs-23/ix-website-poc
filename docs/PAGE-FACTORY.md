# Page factory

Create a whole page, or add one section to an existing page, from **a reference URL** (the layout) plus **your content**
(live incubxperts.com, Strapi, or text you type), rendered on **our theme** with our block library.

```
reference URL ──► 1 CAPTURE ──┐
                              ├─► 3 GENERATE ──► 4 APPLY ──► validated page / section
content source ─► 2 CONTENT ──┘      (Claude)        │         (rolled back if invalid)
 live | strapi | file                                └─► grounding report: every sentence traced to your content
```

## One-time setup
```bash
npm install            # in the web/ folder
```
- Chrome or Edge installed (the capture uses it; nothing is downloaded). Set `CHROME_PATH` if it is in an unusual place.
- Optional, in `.env.local` (never commit it): `STRAPI_URL`, `STRAPI_TOKEN` (read-only API token), `ANTHROPIC_API_KEY`, `FACTORY_MODEL`.

## The full sequence (recommended): one command, with questions and a before/after report
```bash
npm run factory -- run                     # asks the questions, then runs everything in order
npm run factory -- run --brief brief.json  # same, without the questions (automation / repeat runs)
npm run factory -- resume --run .factory/runs/<run>   # continue a paused or failed run
```
In Claude Code, the **`/page-factory`** skill (or `/new-page`, `/add-section`) asks the same questions as menus, writes the brief and drives these commands.

| # | Step | What happens |
|---|---|---|
| 1 | Intake | new page or section · where it goes · reference URL (and which section) · content sources · images (from the content / your files / none) · notes |
| 2 | Baseline | builds the site and measures it as it is now (Lighthouse x3, median) |
| 3 | Capture | reference layout + screenshots |
| 4 | Content | live / Strapi / file / typed text; your own image files are re-encoded with neutral names |
| 5 | Generate | engine `api`: automatic. Engine `prompt` (no key): **pauses (exit code 10)** until Claude Code writes `draft.json` |
| 6 | Apply | schema + validator + grounding check; rolled back if it fails |
| 7 | After | rebuilds and measures again |
| 8 | Report | `report.md`: before/after Lighthouse, load timing, page weight, script size, DOM size, headings, alt text, structured data, sitemap and `llms.txt` counts, content grounding |
| 9 | Publish | posts the report as a pull-request comment (`gh`, GitHub); or later: `npm run factory -- publish --run <run> [--pr N]` |

State is saved after each step. **Exit codes:** `0` done · `10` waiting for `draft.json` · `3` draft rejected (site untouched) · `2` reference blocked automated browsing · `1` error.
`npm run factory -- report --run <run>` re-renders a finished run's report without re-measuring.

A brief looks like this (page mode uses `slug`/`title`/`nav` instead of `page`/`insert`):
```json
{ "mode": "section", "page": "careers", "insert": { "after": "Why join" },
  "reference": { "url": "https://www.cohesity.com/careers/", "section": "How we work", "headed": true },
  "content": ["file:how-we-work.md"], "images": { "mode": "content" }, "notes": "keep it short",
  "measure": { "enabled": true, "runs": 3, "port": 3199 }, "publish": { "prComment": true } }
```

**Reading the report:** accessibility, SEO and best-practices scores are deterministic. Lighthouse *performance* moves about ±8 points between identical runs
(machine load), so the report calls small swings "noise" and also shows page weight, script size and DOM size, which do not depend on load.
For a **new page** there is no "before" for the page itself, so the report shows the new page's scores, the home page before and after (to prove nothing else
got worse), and site-level counts (sitemap URLs, `llms.txt` entries, AI crawlers allowed). Use `--no-measure` to skip measurement, `--skip-baseline` to skip only the "before".

## Single stages and direct commands

**New page**
```bash
npm run factory -- page --reference https://azumo.com/artificial-intelligence --slug services --title "Services" \
  --content live:https://incubxperts.com/services/agentic-solutions#Agentic \
  --content file:notes.md --nav "Services"
```

**New section on an existing page**
```bash
npm run factory -- section --page careers --reference https://www.cohesity.com/careers/ --ref-section "How we work" \
  --content file:how-we-work.md --after "Why join" --headed
```

**Content sources** (repeat `--content` to combine them)

| Spec | Reads |
|---|---|
| `live:<url>[#Heading]` | a live page (text, bullets, images); `#Heading` keeps just that section and its sub-sections |
| `strapi:<collection>[?limit=3&filters[slug][$eq]=x]` | entries via Strapi's REST API, read-only (needs `STRAPI_URL` + `STRAPI_TOKEN`) |
| `file:<path>` | `.md` (headings, paragraphs, bullets, `![alt](src)`), `.txt`, or `.json` |

**Who writes the JSON? (`--engine`)**
- `api` (automatic when `ANTHROPIC_API_KEY` is set): the tool calls Claude, validates, retries on errors, applies.
- `prompt` (automatic otherwise): the tool stops after writing `prompt.md` in `.factory/runs/<run>/`. In Claude Code, use the `/new-page`
  or `/add-section` skill: Claude reads the pack, writes `draft.json`, and runs `npm run factory -- apply --run <run>`.

Then: `npm run build`, review the page, commit on a branch, open a pull request.

## What it guarantees
- **Schema-valid or nothing**: the draft must pass the strict block schema and `npm run validate:pages` (one hero, links and anchors, image hosts, no placeholder text). Failures are rolled back; the site is never left broken.
- **No invented content**: every text item is matched to your sources. Numbers that are not in the sources are always flagged. Add `--strict-grounding` to make any flagged text a hard failure.
- **Client confidentiality**: images from the CMS host are re-encoded to neutral file names (`public/factory-media/`); names never reach page JSON.
- **Layout only**: the reference's text is truncated in the capture and the rules forbid reusing it, its images or its branding.
- **No bypassing site protections**: if a reference blocks automated browsers the tool stops. `--headed` runs a normal visible Chrome window (no stealth or spoofing); if the site still blocks, use the Claude Code skill or supply screenshots.

## Limits (be honest in a review)
- Layout recognition is heuristic: unusual page builders can be split into odd sections. `capture` prints the sections it found; check them.
- The output is limited to our block library. A layout with no matching block needs a new block (a small developer task; see `/new-page`).
- The generated page matches **structure and behaviour**, not pixel-level look; we keep our own colours, fonts and imagery by design.
- Content quality is only as good as the source: the factory will omit a section rather than invent text.
- Not yet verified: the `api` engine against the live Claude API (needs a key), and the Strapi adapter against the real IncubXperts Strapi (needs a token); the Strapi adapter was tested against a mock with Strapi 5's response shape.

## Troubleshooting
| Symptom | Fix |
|---|---|
| "refused the automated browser (HTTP 403)" | re-run with `--headed`; if still blocked, use the skill or screenshots |
| `strapi: HTTP 403` | create a read-only API token (Strapi admin > Settings > API Tokens) and set `STRAPI_TOKEN` |
| `no heading containing "..."` | the message lists the page's headings; use one of them in `#Heading` / `--ref-section` |
| apply exits with code 3 | read the listed errors, fix `draft.json`, run `apply` again |
| a page already exists | pick another `--slug` or add `--force` |

## Where things live
`scripts/factory/` (capture, content, generate, ground, apply, media, serve, measure, report, pipeline, index) · `src/blocks/schema.ts` (the contract) ·
`src/blocks/catalog.ts` (when to use each block) · `.claude/skills/page-factory` (+ `new-page`, `add-section` entry points) ·
`.factory/` (run folders and briefs; git-ignored).
