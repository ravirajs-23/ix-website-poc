---
name: new-page
description: Create a whole new page on the IncubXperts website from a reference URL (layout/styling) plus custom content (the live incubxperts.com site, Strapi, or typed/pasted text), using our theme and block library. Use when the user says things like "add a Services page like https://…", "build a pricing page modelled on this site", or "create a page from this reference with content from …".
argument-hint: <reference-url> <slug> ["Title"] [content: live:<url> | strapi:<collection> | file:<path> ...]
---

# /new-page — whole new page

This is the **page** entry point of the page factory. Follow the `/page-factory` skill with **mode = page** and treat `$ARGUMENTS`
(reference URL, slug, title, content sources) as pre-filled intake answers; still ask for anything missing (slug, title, header-nav
label, content sources, images, measurement and report preferences). Invoke it with the Skill tool: `page-factory` with args `page $ARGUMENTS`.

Page-mode reminders (full rules are in `/page-factory`):
- Exactly one `hero` block, first (it renders the only `<h1>`); SEO title <= 60 chars, description 120-160 chars, `summary`, correct `schemaType`; set `reference`.
- `npm run factory -- run --brief .factory/briefs/<slug>.json --engine prompt` then write `draft.json` as `{ "page": …, "rationale": … }` and `resume`.
- The page appears at `/<slug>`; `--nav "Label"` (brief field `nav`) adds it to the header (appended last; reorder in `src/lib/site.ts` if needed).

## New block or variant (only when nothing fits)
Extend `src/blocks/schema.ts` (strict, optional props for variants), implement in `static-blocks.tsx` / `interactive.tsx`, register in
`index.tsx`, describe it in `catalog.ts`, run `npm run schema:export`, and tell the user a developer should review it.

## Next.js notes (Cache Components enabled)
`params` is a Promise; data readers use `"use cache"`; no `new Date()` in server components outside cached functions. Read `AGENTS.md` first.
