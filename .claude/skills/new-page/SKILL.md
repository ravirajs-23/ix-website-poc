---
name: new-page
description: Create a whole new page on the IncubXperts website from a reference URL (layout/styling) plus custom content (the live incubxperts.com site, Strapi, or typed/pasted text), using our theme and block library. Use when the user says things like "add a Services page like https://…", "build a pricing page modelled on this site", or "create a page from this reference with content from …".
argument-hint: <reference-url> <slug> ["Title"] [content: live:<url> | strapi:<collection> | file:<path> ...]
---

# /new-page — whole page from a reference URL + your content

This runs the **page factory** (`npm run factory`): capture the reference → read the content → generate JSON for our
block library → validate, check grounding, apply. You (Claude) are the generation step when no API key is configured.
Full guide for people: `docs/PAGE-FACTORY.md`.

Arguments: `$ARGUMENTS`. If anything is missing, ask for: reference URL, slug (lowercase-with-hyphens), page title,
content source(s), and whether it belongs in the header nav (`--nav "Label"`).

## Hard rules (the tool also enforces most of them)
1. **Layout only from the reference.** Never reuse the reference's text, images, logos, icons, brand elements or code. Our colours and fonts come from the theme.
2. **Content integrity.** Every sentence, number, claim, name and image must come from the supplied content. Never invent. If a reference section cannot be supported by the content, omit it and say so. The grounding check flags anything it cannot trace; fix or remove each flagged item.
3. **Client confidentiality.** Case studies stay anonymized; never use a Strapi `RelatedProjects`/internal-name field; CMS images are copied locally with neutral names automatically.
4. **Only existing blocks and props** (`src/blocks/schema.ts` is strict; `src/blocks/catalog.ts` says when to use each). If nothing fits, follow "New block or variant" below.
5. **Never bypass site protections.** If the reference blocks automated browsers, use `--headed` (a normal visible Chrome window). If it still blocks or shows a challenge, stop and tell the user. Do not spoof user agents or solve challenges.
6. **Do not push or open merge/pull requests unless asked.** Work on a branch `feature/page-<slug>`.

## Procedure
1. **Prerequisites**: `npm install` done; Chrome or Edge installed. For `strapi:` content: `STRAPI_URL` and a read-only `STRAPI_TOKEN` in `.env.local` (ask the user to create the token; never ask them to paste it into chat).
2. **Run the first stages** (no key needed):
   ```bash
   npm run factory -- page --reference <url> --slug <slug> --title "<Title>" \
     --content live:<incubxperts-url>[#Section heading] --content file:<notes.md> [--nav "<Label>"] --engine prompt
   ```
   Repeat `--content` to combine sources. Add `--headed` for sites that block headless browsers.
3. **Read the prompt pack** the tool prints (`.factory/runs/<run>/prompt.md`): system rules, reference structure, content, and the screenshots listed at the top (open them with the Read tool and actually look at them).
4. **Write `draft.json`** in the run folder: `{ "page": <PageDefinition>, "rationale": "<how you mapped it and what you omitted and why>" }` (schema: `output.schema.json`). Map layouts to blocks as listed in the prompt. Alternate `bg` for rhythm, one hero first, SEO title <= 60 chars and description 120-160, `reference` = the reference URL.
5. **Apply**: `npm run factory -- apply --run .factory/runs/<run>`. Exit code 3 = rejected and rolled back; read the errors, fix `draft.json`, re-run. Review the **Grounding** list and fix every flagged item (reword from the sources or delete it).
   If `ANTHROPIC_API_KEY` is set you can instead run the same command with `--engine api` (fully automatic, with retries).
6. **Check it**: `npm run build`, start `npx next start -p 3100`, then look at the result with the factory's own capture: `npm run factory -- capture http://localhost:3100/<slug> --out .factory/ours` and view `.factory/ours/shots/*.jpg` next to the reference shots. Confirm one `<h1>`, no horizontal overflow, and run Lighthouse on `/<slug>` (accessibility, best practices, SEO should be 100; performance >= 85). Stop the server afterwards.
7. **Report** to the user: how each reference section was mapped, what was omitted and why, content gaps, grounding result, validation and Lighthouse results, and an honest similarity assessment (structure vs visual).
8. **Git**: `git checkout -b feature/page-<slug>`, commit. Do not push unless asked (remotes: `origin` GitLab, `github`; GitHub is the source of truth; always push both when asked).

## New block or variant (only when nothing fits)
Extend `src/blocks/schema.ts` (strict, optional props for variants), implement in `static-blocks.tsx` / `interactive.tsx`, register in `index.tsx`, describe it in `catalog.ts`, run `npm run schema:export`, and tell the user a developer should review it.

## Next.js notes (Cache Components enabled)
`params` is a Promise; data readers use `"use cache"`; no `new Date()` in server components outside cached functions. Read `AGENTS.md` first.
Write JSON with the Write/Edit tools, not shell heredocs or `node -e` (escape sequences get mangled).
