---
name: add-section
description: Add a new section to an EXISTING page of the IncubXperts website, modelled on one section of a reference URL (layout/styling), filled with custom content (the live incubxperts.com site, Strapi, or typed/pasted text), using our theme and block library. Use for requests like "add a 'How we work' section to the Careers page like this one: https://…", "add a testimonials band from Strapi to the home page, styled like …".
argument-hint: <page-slug> <reference-url> "<reference section heading>" [content: live:<url> | strapi:<collection> | file:<path> ...] [--after "<section>" | --before "<section>"]
---

# /add-section — one new section on an existing page

This is the **section** entry point of the page factory. Follow the `/page-factory` skill with **mode = section** and treat `$ARGUMENTS`
(page, reference URL, reference section heading, content sources, insert position) as pre-filled intake answers; still ask for anything
missing (which page, **after or before which existing section**, content sources, images, measurement and report preferences).
Invoke it with the Skill tool: `page-factory` with args `section $ARGUMENTS`.

Section-mode reminders (full rules are in `/page-factory`):
- First read `src/content/pages/<page>.json` and show the user its blocks so they can pick the position.
- `draft.json` is `{ "blocks": [<1-2 Block>], "rationale": … }`: only the NEW block(s), never a hero, no duplicate of what the page already has,
  `anchor` values unique, and a `bg` that keeps the page's light/surface/dark rhythm (no two similar backgrounds side by side).
- `--ref-section` / `reference.section` is matched against the reference's headings (the error lists them if it does not match).
- Insert position fields: `after` / `before` (text from a block's heading, or `type:faq`), `at` (`start` | `end`), or `index`; default is before the closing call-to-action.
- If the section needs a block that does not exist, extend the schema as described in `/new-page` ("New block or variant").
