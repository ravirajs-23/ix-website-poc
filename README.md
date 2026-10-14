# IncubXperts website (POC)

Next.js (App Router, Cache Components) + Tailwind v4. Static pages are JSON; jobs, case studies and
testimonials come from Strapi with a local JSON fallback.

```bash
npm install
cp .env.example .env.local   # set STRAPI_* / NEXT_PUBLIC_SITE_URL
npm run dev                  # http://localhost:3000
npm run build && npm start   # production check
```

## Adding a page (repeatable workflow)
**With Claude Code:** run `/new-page <reference-url> <slug> [title] [content source]`. The skill (`.claude/skills/new-page`)
analyses the reference page's layout, maps each section to our blocks, builds the page from real IncubXperts content,
validates it, builds it, checks it against Lighthouse and commits it on a branch.

**By hand:**
```bash
npm run new:page -- services "Services" --reference https://example.com/services --ref-name "Example — Services" --nav "Services"
# edit src/content/pages/services.json (replace every TODO)
npm run validate:pages   # strict schema + one hero + links/anchors + image hosts + placeholder text
npm run build
```
`src/blocks/schema.ts` is the single source of truth for page/block shapes; `npm run schema:export` writes
`src/content/page.schema.json` (editor autocompletion for page JSON, and a contract for agents).

## How pages work
- `src/content/pages/<slug>.json` = one page (`home.json` is `/`). A page is `{ path, seo, blocks[] }`.
- Dropping a new JSON file there creates a new statically generated route (`src/app/[slug]/page.tsx`).
- Blocks are defined in `src/blocks/types.ts` (schema), `static-blocks.tsx` / `interactive.tsx` / `index.tsx`
  (components) and described in `src/blocks/catalog.ts` (machine-readable "when to use" notes for the phase-2 agent).
- Theme tokens live in `src/app/globals.css` (`:root` + `@theme`). Restyle there, not per page.
- `content/build-content.mjs` (repo root) regenerates the JSON from `content/_source/ix-extract.json`.

## Strapi
1. `node strapi-schemas/install.mjs <path-to-strapi>` then restart Strapi.
2. Allow `find`/`findOne` for the three types (Public role or an API token).
3. `STRAPI_URL=... STRAPI_TOKEN=... node strapi-schemas/seed.mjs` to load the current data.
4. Add a Strapi webhook to `POST /api/revalidate` with header `x-revalidate-secret`.

## SEO / AI-SEO checklist (implemented)
Unique title/description/canonical per page, OG/Twitter, one H1 per page, JSON-LD (Organization, WebSite,
WebPage/AboutPage/ContactPage/CollectionPage, BreadcrumbList, FAQPage, JobPosting, Article), `sitemap.xml`,
`robots.txt` (all AI crawlers allowed), `llms.txt`, static HTML for all content, skip link, AA contrast.

## Before launch
- Set `NEXT_PUBLIC_SITE_URL` to the real domain.
- Replace the two SAMPLE jobs (Strapi) with real openings.
- Have legal review `/privacy` (draft).
- Contact form (`/api/contact`) only logs; connect it to email/CRM.
- Unknown URLs render the 404 page with `noindex` but HTTP status 200 (Cache Components streaming limitation);
  configure a host-level 404 if a hard status is required.
