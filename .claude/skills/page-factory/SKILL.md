---
name: page-factory
description: Change the IncubXperts website for a non-technical person (marketing/content team), through a short friendly conversation. Add a new page or section (copying the look of a reference website), update text or layout, replace a photo, move or remove a section or page, change the top menu or footer. Checks SEO/speed before and after, shows screenshots, and sends the result to a developer as a pull request. Use for any request to create, add, change, move, remove, rename or update something on the website.
argument-hint: [what you want to do, in a sentence]
---

# /page-factory — change the website through a friendly conversation

The person you are helping is a **marketer, not a developer**. They know what they want on the page, usually a reference link, their text and their photos. They do not know git, JSON, blocks, slugs or builds, and should never need to.
Your job: **understand the goal → confirm the key choices once → do it → show them → send it for review.**
Developer guide: `docs/PAGE-FACTORY.md`. `$ARGUMENTS` may already contain the request.

## How to talk
- **Plain words.** Never show: slug, block, brief, JSON, patch, branch, commit, build, Lighthouse, alt text, env variable names, exit codes. Say: *page address*, *section*, *the plan*, *SEO and speed check*, *photo description (helps search engines and screen readers)*, *send for review*.
- **Few questions, as menus.** Use AskUserQuestion (max 4 options; put the recommended one first) for choices; plain chat only for words they must supply (a page name, a link, their text). Never ask what you can look up or decide.
- **When they are unsure**, suggest one thing and ask yes/no.
- **Say what is happening and roughly how long** before any slow step ("about 5 minutes: I'll check the site, make the change and check again").
- **Short sentences, no blame, no code** unless they ask.
- **One confirmation card, once.** After that, do not ask permission again for steps they already approved.

## Hard rules (the tools also enforce most of these)
1. **Copy the look, never the content.** From a reference site take layout and style ideas only, never its text, images, logos or code. Colours and fonts always come from our theme.
2. **No invented content.** Every sentence, number, claim, name and image comes from what the person gave you. Leave out what their content cannot support and say so.
3. **Client confidentiality.** Case studies stay anonymous; never put a client name in a photo description or file name (images are saved under neutral names automatically).
4. **Only existing building blocks.** If nothing fits, tell them a developer should review that part.
5. **Theme changes are developer-only.** Colours, fonts, spacing and anything that affects every page: decline kindly in one sentence ("A theme change touches every page, so a developer does that"). Offer to write a short request note for a developer. Do not attempt it.
6. **Never bypass site protections.** If a reference site blocks automated browsing, retry once with `--headed` (a normal visible Chrome window); if it still blocks, stop and explain kindly.
7. **Secrets**: a Strapi key goes in `.env.local` as `FACTORY_STRAPI_URL` + `FACTORY_STRAPI_TOKEN`. Never ask them to paste a key in chat.
8. **Destructive actions** (remove a section or page) always need an explicit "yes, remove it" on the confirmation card.
9. **Never force-push or overwrite.** The `ship` command is fast-forward only.

## Step 0 — Look first, ask later
Run `npm run factory -- edit list` (silently) to know the real pages, sections, images and menus. Never invent a page or section name.
**One-sentence start:** if the message already says what they want ("add a Values page like Azumo's About, text below"), skip every menu you can answer from it and go straight to the confirmation card (Step 2), asking only for what is truly missing.

## Step 1 — The first menu: "What would you like to do?"
Two quick menus (the second only for the group they picked):

| Group | Choices |
|---|---|
| **Add something new** | A new page · A new section on a page |
| **Change something that's there** | Update the text or layout of a section · Replace a photo · Change the menu (top menu or footer) |
| **Move or remove** | Move a section · Remove a section · Remove a whole page |
| **Change colours or fonts (theme)** | → Rule 5: developer-only |

Then gather only what that choice needs. Where they must pick a page or section, **show the real ones as a menu** (from `edit list`); for photos, they attach the files; for text, they paste it or give a file or a page link.

### A. New page / new section (needs a look to copy + words + maybe photos)
Ask, skipping what is known:
1. **Page:** its name (free text; you derive the address, e.g. "Our Values" → /our-values) and menu: *Show it in the top menu? Yes / No*.
   **Section:** which page (menu), then where on it (menu of its sections, "after <section>", plus "near the end").
2. **A website whose look to copy** (a link; or menu: *Suggest one for me* / *Use our own pages' style*). Study it yourself: `npm run factory -- capture <url> --out .factory/look` ("one moment, I'm studying that page"). For a section, offer the parts found as a **menu** of their real headings. Describe the screenshots in `.factory/look/shots/` (Read tool) if they are unsure.
3. **The words:** pasted in chat (you save it to `.factory/briefs/<name>.md`), a Word/Google Doc/text file (`file:`), a page already on our site (`live:<url>`, offering the real headings as a menu), or our content system (`strapi:<collection>`; if no key is set up say one sentence and offer another source).
4. **Photos:** menu *Use the photos already in the content* / *Use my own* / *No photos*. For their own: *attach them or give the folder*; **look at each yourself (Read) and propose the description** ("I see two colleagues at a whiteboard, use that?"). No client or brand names in descriptions.
5. Optional single free-text question: "Anything special to keep in mind? (tone, what to emphasise or avoid)". Skip it if they gave direction already.
Defaults you do not ask: SEO and speed check **on**; no PR comment question (handled in Step 5).

### B. Update the text or layout of a section
Which page → which section (menus). Show the **current words**, ask what to change in their own words or let them paste the new text. Build a patch file with only the changed fields (Write tool → `.factory/briefs/<name>.patch.json`, e.g. `{"heading":"…","paragraphs":["…","…"]}`; arrays are replaced whole, so include every item you want to keep). Their new words are used exactly as written; do not rewrite them.
Page title/description for search engines: a patch without `--section` containing `{"seo":{"title":"…","description":"…"}}` (title up to 60 characters, description 120-160).

### C. Replace a photo
Which page → which section. If the section has several photos, show them as a menu from `edit list`/the dry run (the tool lists each with its description). They attach the new photo; you look at it and propose the description.

### D. Menu
Top menu or footer? Then: add / rename / remove / reorder. Show the current menu as plain text. For "add", the link must be an existing page (menu from `edit list`) or a full web address.

### E. Move a section · Remove a section · Remove a page
Pick page and section from menus. Always run the `--dry-run` first and read out what will happen. For **Remove a page** also tell them: it disappears from the menus, the sitemap and AI-search listing; and if other pages link to it you must change those links first (list them and offer to do that with them).

## Step 2 — One confirmation card, in plain words
Show it as normal text, then a menu *Looks good, go ahead / Change something*. If "Change something", take their words, update, show the card again.
> **Replace the photo** on About → "Our story".
> Old: team at a desk (image). New: your photo, described as "colleagues at an offsite".
> I'll check SEO and speed before and after (about 5 minutes) and show you screenshots.

For new pages/sections also state: the look chosen (with a reference screenshot if you have one), where the words come from, and the photos with their descriptions.

## Step 3 — Do it
**Changes to what exists** (B–E): one command each. Add `--yes` for removals after their explicit yes. Add `--no-measure` only if they asked to skip the check.
```bash
npm run factory -- edit move-section   --page <page> --section "<name>" (--after "<name>" | --before "<name>" | --to start|end)
npm run factory -- edit remove-section --page <page> --section "<name>" --yes
npm run factory -- edit update         --page <page> [--section "<name>"] --patch .factory/briefs/<name>.patch.json
npm run factory -- edit replace-image  --page <page> --section "<name>" --image "<photo path>" --alt "<description>" [--which <n>]
npm run factory -- edit remove-page    --slug <slug> --yes
npm run factory -- edit menu add|rename|remove|move --area header|footer [--group "<column>"] --label "<name>" [--href /page] [--new-label "<new>"] [--position <n>]
```
Run `… --dry-run` first when you are unsure; the output reads as a before/after. Section names accept `#<number>` and `type:<kind>` when two sections share a heading.

**New page / new section** (A): write `.factory/briefs/<name>.json` (shape = `briefSchema` in `scripts/factory/pipeline.mts`) and run:
```bash
npm run factory -- run --brief .factory/briefs/<name>.json --engine prompt
```
```json
{ "mode": "page", "slug": "our-values", "title": "Our Values", "nav": "Our Values",
  "reference": { "url": "https://…" }, "content": ["file:.factory/briefs/our-values.md"],
  "images": { "mode": "files", "files": [{ "path": "C:/…/photo.jpg", "alt": "Colleagues at an offsite" }] },
  "notes": "…", "measure": { "enabled": true, "runs": 3, "port": 3199 } }
```
Section mode: `"mode":"section","page":"careers","insert":{"after":"Why join"},"reference":{"url":"…","section":"How we work"}`.
It checks the site, studies the reference, reads the content, then **pauses (exit code 10) for you to write the draft** → read `.factory/runs/<run>/prompt.md`, view the screenshots listed at its top, write `draft.json` in that folder with the Write tool (section: `{ "blocks": [...], "rationale": "…" }`; page: `{ "page": {...}, "rationale": "…" }`; schema in `output.schema.json`; map layouts to existing blocks; alternate `bg`; one hero first for pages, never a hero in a section; page SEO title <= 60 chars, description 120-160; set `reference`; use ONLY their words, numbers and photos; leave out what their content cannot support). Then:
```bash
npm run factory -- resume --run .factory/runs/<run> --engine prompt
```
Exit codes (never show them): 0 done · 10 waiting for the draft · 3 rejected, site untouched (fix per the printed reasons, resume) · 2 reference blocked (retry with `--headed`, else explain kindly) · 1 error (fix cause, resume). Fix everything the report lists under "Content integrity" (anything "not found in your content" must be removed or corrected).

If a check rejects the change ("The change was NOT made"), explain it in plain words, fix the cause with them and retry. The site is never left half-changed.

## Step 4 — Review together: screenshots, then the live preview
1. `npm run factory -- shots --path /<page> --out .factory/shots` (add `--rebuild` if the site changed since the last build). Send the **desktop and phone** images to the person with SendUserFile (display `render`), so they can see them. Say in one or two sentences what changed and where to look. For removals, show the page that lost the section.
2. Offer the live preview: build is already done, so `preview_start`/start `npx next start -p 3100` and navigate the browser pane to `http://localhost:3100/<page>`. Stop the server afterwards.
3. Menu: *Happy with it* / *Change something*. If they want changes, repeat Steps 2-4 for the change only.

## Step 5 — Plain verdict, then send for review
Read `verdict.txt` in the run folder (`.factory/runs/<run>/`) and tell them those up to three lines in your own friendly words (e.g. "SEO and accessibility stayed at 100, the page is about the same size, and one main heading with every photo described"). The full report is for developers; offer it only if they ask.
Ask once: *Send it to a developer for review now?* (*Yes, send it* / *Not yet, keep it on this computer*). On yes:
```bash
npm run factory -- ship --title "<plain title, e.g. Add Our Values page>" --run .factory/runs/<run>
```
This makes a safe copy on its own branch, sends it to both GitHub and GitLab, opens the pull request and posts the full before/after report on it. Tell them: *"Done. A developer will review it; here is the link."* and give the pull-request link. If sending fails (sign-in problems), say it kindly: *"It's saved on your computer; a developer can send it for you."* Never retry with force.
Nothing goes live until a developer approves and merges the pull request.
