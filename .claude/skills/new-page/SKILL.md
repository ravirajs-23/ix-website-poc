---
name: new-page
description: Add a new page to the IncubXperts website by modelling its layout on a reference website page. Use when the user gives a reference URL (a competitor or inspiration page) and wants a new page, section or page redesign built from the existing block library with IncubXperts content, theme and SEO — e.g. "add a services page like https://…", "build our pricing page using this site as reference".
argument-hint: <reference-url> <slug> [page title] [content source]
---

# /new-page — build a page from a reference URL

Pages in this project are JSON files (`src/content/pages/<slug>.json`) made of typed blocks. A new file is
a new statically generated route with SEO, sitemap and `llms.txt` handled automatically. Your job is to turn
a **reference page's layout** into such a file, using **IncubXperts content** and **our theme**.

Arguments: `$ARGUMENTS` (reference URL, slug, optional title and content source). If anything is missing,
ask before starting: reference URL, slug + title, where the content comes from, sections to include/exclude,
and whether the page goes in the header nav.

## Hard rules
1. **Take structure and behaviour only.** Never copy the reference's text, images, logos, icons, brand
   elements or code. Colours and fonts always come from our tokens (`src/app/globals.css`).
2. **Never invent facts.** Content comes only from the user, incubxperts.com, or `content/_source/ix-extract.json`
   (repo root, outside this git repo). No made-up stats, awards, certifications, clients, quotes, employee
   names or job openings. If a section needs content we don't have, omit it and report the gap.
3. **Client confidentiality.** Case studies stay anonymized. Never use the `_internalProjectName_notShownOnPage`
   field. If a case-study image file name contains a client name, flag it to the user instead of surfacing it.
4. **Only existing blocks and props.** The schema is strict (`src/blocks/schema.ts`): unknown props fail
   validation. If nothing fits, follow "New block or variant" below — do not invent JSON props.
5. **Images**: only hosts allowed in `next.config.ts` (`images.remotePatterns`) or files under `public/`, each with
   meaningful `alt` text. Use IncubXperts' own images, never the reference's.
6. **One hero, first.** It renders the page's only `<h1>`.
7. **Be honest about fidelity.** Report structural match and visual match separately; do not round up.

## Procedure

### 0. Orient
- Read `AGENTS.md` (this Next.js version differs from older versions), `src/blocks/schema.ts`,
  `src/blocks/catalog.ts`, and one or two existing pages in `src/content/pages/` for conventions.
- Write page JSON with the **Write/Edit tools**, not shell heredocs or `node -e` (backslash/escape mangling
  has corrupted files before).

### 1. Capture the reference
Use the browser tools (own tab; desktop and mobile). Set `document.documentElement.style.scrollBehavior='auto'`,
scroll in ~400–600px steps with short waits (many sites reveal content on scroll), screenshot, and use
`get_page_text`/`javascript_tool` to enumerate sections. Produce a table:

| # | Section | Purpose | Layout (cols, alignment) | Components | Interactions | Content it needs | Background tone |

Also note header/footer patterns, sticky/pinned behaviour, and mobile behaviour.

### 2. Map to blocks
For each section choose a block + options from `catalog.ts`, or mark **NEW** (needs a new block/variant) or
**SKIP** (content we don't have). Alternate `bg` (`light`/`surface`/`dark`) for rhythm; add `anchor` where a CTA
should jump to a section. **Show the user the mapping table** and get a go-ahead if there is any NEW block,
any SKIP, or any content gap.

### 3. Gather content
Pull real IncubXperts content for each mapped section. List every gap explicitly.

### 4. Scaffold and fill
```bash
npm run new:page -- <slug> "<Title>" --reference <url> --ref-name "<Site — Page>" [--nav "<Nav label>"]
```
Then replace the scaffold's `TODO` blocks with the mapped blocks. SEO: `title` ≤ 60 chars, `description` 120–160 chars,
a one-sentence `summary` (used in `llms.txt`), and the right `schemaType`. Keep `reference` (temporary review badge
and provenance).

### 5. Validate
```bash
npm run validate:pages     # schema, one hero, links/anchors, image hosts, placeholder text — must be 0 errors
npx tsc --noEmit && npx eslint src
```
Fix everything. `npm run build` also runs the validator first.

### 6. Build and check
```bash
npm run build && npx next start -p 3100     # run the server in the background
```
- Compare with the reference on desktop and mobile; confirm one `<h1>`, no horizontal overflow, no console errors.
- Lighthouse on the new route (`npx lighthouse@12 http://localhost:3100/<slug> --only-categories=performance,accessibility,seo,best-practices`):
  accessibility, best-practices and SEO must be 100; performance ≥ 85. Fix regressions (common causes: contrast on
  faded text, invalid `<dl>` markup, large images without `sizes`).
- Stop the server when done.

### 7. Report to the user
Sections mapped (and how), what was skipped and why, content gaps, any new blocks, validation and Lighthouse
results, and an honest similarity assessment (structure vs visual). Include screenshots when useful.

### 8. Git
Create `feature/page-<slug>` from `main`, commit (`Add <slug> page modelled on <reference>`). **Do not push or open a
merge request unless asked.** Remotes: `origin` = GitLab (`ravirajs/ix-website-poc`), `github` = private GitHub repo.
Never make a repository public without the user's explicit confirmation.

## New block or variant (only when nothing fits)
1. Add or extend the zod schema in `src/blocks/schema.ts` (strict objects; optional props for variants).
   `src/blocks/types.ts` re-exports inferred types — don't hand-write types.
2. Implement in `src/blocks/static-blocks.tsx` (server) or `interactive.tsx` (client, only if it needs state),
   register in `src/blocks/index.tsx`, and describe it in `src/blocks/catalog.ts` ("when to use").
3. Keep the theme tokens, accessibility (keyboard, `aria-*`, contrast ≥ 4.5:1, `prefers-reduced-motion`) and
   server-rendered content (all text in the HTML for crawlers).
4. Run `npm run schema:export` to refresh `src/content/page.schema.json`.
5. Tell the user a developer should review the new block.

## Next.js notes for this repo (Cache Components enabled)
- `params` is a Promise; await it. Data readers that touch the filesystem or network use `"use cache"` + `cacheLife`.
- Don't call `new Date()`/`Math.random()` in server components outside cached functions.
- Unknown URLs render the 404 UI with `noindex` but status 200 (known limitation).
