---
name: add-section
description: Add a new section to an EXISTING page of the IncubXperts website, modelled on one section of a reference URL (layout/styling), filled with custom content (the live incubxperts.com site, Strapi, or typed/pasted text), using our theme and block library. Use for requests like "add a 'How we work' section to the Careers page like this one: https://…", "add a testimonials band from Strapi to the home page, styled like …".
argument-hint: <page-slug> <reference-url> "<reference section heading>" [content: live:<url> | strapi:<collection> | file:<path> ...] [--after "<section>" | --before "<section>"]
---

# /add-section — one new section on an existing page

Uses the **page factory** (`npm run factory -- section ...`). Same pipeline as `/new-page`, but the output is 1-2 blocks
inserted into `src/content/pages/<page>.json`. Full guide for people: `docs/PAGE-FACTORY.md`.

Arguments: `$ARGUMENTS`. Ask if missing: target page slug, reference URL, the **heading of the reference section** to copy
the layout from, the content source(s), and where to insert it (after/before which existing section).

## Hard rules
Same as `/new-page`: layout only from the reference (never its text/images/logos/code); content only from the supplied
sources (no invented facts, numbers, quotes); client names stay anonymized; only existing blocks and props; never get around
bot protection (use `--headed`, otherwise stop and tell the user); do not push or open PRs unless asked.
Section-specific: return only the NEW block(s) (never a hero); do not duplicate sections already on the page; match the page's
existing rhythm (`bg` light / surface / dark) so two similar backgrounds are not adjacent; keep `anchor` values unique.

## Procedure
1. **Look at the page first**: read `src/content/pages/<page>.json` (what is there, in what order).
2. **Run the first stages**:
   ```bash
   npm run factory -- section --page <slug> --reference <url> --ref-section "<reference heading>" \
     --content <source> [--content <source>] --after "<existing section heading>" --engine prompt
   ```
   `--ref-section` picks the reference section by heading text (the error lists the headings if it does not match).
   Insert position: `--after` / `--before` (text of a block's heading, or `type:faq`), `--at start|end`, or `--index N`.
   Default: before the closing call-to-action. Add `--headed` for sites that block headless browsers.
3. **Read the prompt pack** (`.factory/runs/<run>/prompt.md`) and **view the reference screenshot(s)** it lists with the Read tool.
4. **Write `draft.json`**: `{ "blocks": [<Block>...], "rationale": "<mapping, omissions and why>" }` (1-2 blocks; schema in `output.schema.json`).
   Prefer the closest block + options (e.g. split text + photo = `richText` with `media` and `frame`; 3-up values = `iconGrid`; quotes = `testimonials`).
5. **Apply**: `npm run factory -- apply --run .factory/runs/<run>`. Exit 3 = rejected and rolled back (errors listed). Fix every item in the
   **Grounding** list. With `ANTHROPIC_API_KEY` set, `--engine api` does steps 3-5 automatically.
6. **Check it**: `npm run build`, serve on 3100, capture our page with `npm run factory -- capture http://localhost:3100/<page> --out .factory/ours`, view the new section's screenshot next to the reference's, check mobile, run Lighthouse on the page.
7. **Report** the mapping, omissions, grounding result and checks. **Git**: branch `feature/section-<page>-<name>`, commit; push only if asked.

If the section needs a block that does not exist, extend the schema as described in `/new-page` ("New block or variant").
Write JSON with the Write/Edit tools, not shell heredocs or `node -e`.
