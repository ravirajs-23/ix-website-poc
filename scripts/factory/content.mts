/**
 * Stage 2 — CONTENT adapters. Three sources, one normalised shape.
 *
 *   node scripts/factory/content.mts <spec> [<spec> ...] [--out content.json] [--headed]
 *
 * Specs:
 *   live:<url>[#Section heading]     text/images from a live page (e.g. https://incubxperts.com/about-us);
 *                                    "#Heading" keeps only that section (and its sub-sections)
 *   strapi:<collection>[?query]      entries from Strapi's REST API, read-only. Needs STRAPI_URL and STRAPI_TOKEN.
 *                                    query examples: limit=3  |  filters[slug][$eq]=my-case  |  sort=DisplayOrderNumber
 *   file:<path>                      manual content: .md (headings, paragraphs, bullets, ![alt](src)), .txt, or .json
 *
 * Every generated page is later checked against this bundle: text that cannot be traced back to it is flagged,
 * so content here is the ONLY source of facts for a page.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";
import { findChrome } from "./capture.mts";

export type ContentSection = {
  heading?: string;
  level?: number;
  paragraphs: string[];
  bullets: string[];
  images: { src: string; alt?: string }[];
  links: { label: string; href: string }[];
  /** Where this came from (shown in the grounding report). */
  source: string;
};
export type ContentBundle = { createdAt: string; sources: string[]; sections: ContentSection[] };

const empty = (source: string, heading?: string, level?: number): ContentSection => ({ heading, level, paragraphs: [], bullets: [], images: [], links: [], source });

/* ------------------------------------------------------------------ live */

/** Runs in the page: ordered outline of headings, paragraphs, bullets, images and button-like links. */
function extractOutline(): { heading?: string; level?: number; paragraphs: string[]; bullets: string[]; images: { src: string; alt?: string }[]; links: { label: string; href: string }[] }[] {
  const out: ReturnType<typeof extractOutline> = [];
  let cur: (typeof out)[number] = { paragraphs: [], bullets: [], images: [], links: [] };
  const flush = () => {
    if (cur.heading || cur.paragraphs.length || cur.bullets.length || cur.images.length) out.push(cur);
  };
  const root = document.querySelector("main") ?? document.body;
  const skip = (el: Element) => !!el.closest("header,footer,nav,[role=navigation],[role=banner],script,style,noscript,template,[aria-hidden=true]");
  const shown = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && (el as HTMLElement).offsetHeight > 0;
  };
  const text = (el: Element) => (el.textContent ?? "").replace(/\s+/g, " ").trim();
  const seen = new Set<string>();
  const once = (list: string[], t: string) => {
    const k = t.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      list.push(t);
    }
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode() as Element | null; n; n = walker.nextNode() as Element | null) {
    if (skip(n) || !shown(n)) continue;
    const tag = n.tagName;
    if (/^H[1-4]$/.test(tag)) {
      const t = text(n);
      if (!t) continue;
      flush();
      cur = { heading: t, level: Number(tag[1]), paragraphs: [], bullets: [], images: [], links: [] };
    } else if (tag === "P") {
      const t = text(n);
      if (t.length >= 20) once(cur.paragraphs, t);
    } else if (tag === "LI") {
      const t = text(n);
      if (t.length >= 3 && t.length < 220 && !n.querySelector("p,ul,ol")) once(cur.bullets, t);
    } else if (tag === "IMG") {
      const img = n as HTMLImageElement;
      const src = img.currentSrc || img.src;
      if (src && !src.startsWith("data:") && img.naturalWidth >= 200 && !cur.images.some((i) => i.src === src)) cur.images.push({ src, alt: img.alt || undefined });
    } else if (tag === "A") {
      const a = n as HTMLAnchorElement;
      const t = text(a);
      const cls = String(a.className);
      if (t.length > 1 && t.length < 36 && a.href && (/btn|button|cta/i.test(cls) || parseFloat(getComputedStyle(a).borderRadius) > 3)) cur.links.push({ label: t, href: a.href });
    }
  }
  flush();
  return out;
}

async function fromLive(spec: string, headed: boolean): Promise<ContentSection[]> {
  const [url, sectionFilter] = spec.split("#").length > 1 && /^https?:/.test(spec) ? [spec.slice(0, spec.indexOf("#")), spec.slice(spec.indexOf("#") + 1)] : [spec, undefined];
  const browser = await chromium.launch({ executablePath: findChrome(), headless: !headed });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    if (res && res.status() >= 400) throw new Error(`live:${url} returned HTTP ${res.status()}`);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 500) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(100);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    let sections = (await page.evaluate(extractOutline)).map((s) => ({ ...s, source: `live:${url}` }));
    if (sectionFilter) {
      const needle = decodeURIComponent(sectionFilter).toLowerCase();
      const start = sections.findIndex((s) => s.heading?.toLowerCase().includes(needle));
      if (start < 0) throw new Error(`live:${url}: no heading containing "${sectionFilter}". Headings found: ${sections.map((s) => s.heading).filter(Boolean).slice(0, 12).join(" | ")}`);
      const lvl = sections[start].level ?? 2;
      let end = start + 1;
      while (end < sections.length && (sections[end].level ?? 9) > lvl) end++;
      sections = sections.slice(start, end);
    }
    return sections;
  } finally {
    await browser.close();
  }
}

/* ---------------------------------------------------------------- strapi */

const SYSTEM_KEYS = new Set(["id", "documentId", "createdAt", "updatedAt", "publishedAt", "locale", "localizations", "slug", "createdBy", "updatedBy"]);
const HEADING_KEYS = /^(title|name|heading|testimonyname|header)$/i;
const stripMarkup = (s: string) =>
  s
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>]+/g, "")
    .replace(/[ \t]+/g, " ")
    .trim();

/** Strapi "blocks" rich text (array of {type, children[{text}]}) to plain paragraphs. */
function blocksToParagraphs(blocks: unknown[]): string[] {
  const out: string[] = [];
  const textOf = (n: unknown): string => {
    if (!n || typeof n !== "object") return "";
    const o = n as { text?: string; children?: unknown[] };
    return (o.text ?? "") + (o.children ? o.children.map(textOf).join("") : "");
  };
  for (const b of blocks) {
    const t = textOf(b).replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
}

function entryToSection(entry: Record<string, unknown>, collection: string, base: string): ContentSection {
  const src = `strapi:${collection}`;
  const sec = empty(src);
  const media = (v: unknown) => {
    for (const m of Array.isArray(v) ? v : [v]) {
      const o = m as { url?: string; alternativeText?: string } | null;
      if (o?.url) sec.images.push({ src: o.url.startsWith("http") ? o.url : base + o.url, alt: o.alternativeText ?? undefined });
    }
  };
  for (const [key, val] of Object.entries(entry)) {
    if (SYSTEM_KEYS.has(key) || val === null || val === undefined || val === "") continue;
    if (typeof val === "string") {
      if (HEADING_KEYS.test(key) && !sec.heading) sec.heading = stripMarkup(val);
      else if (/image|logo|media|cover|banner|bg/i.test(key)) continue; // string URL fields are not prose
      else if (val.length < 90 && !/[.!?]$/.test(val)) sec.bullets.push(`${key}: ${stripMarkup(val)}`);
      else for (const p of stripMarkup(val).split(/\n{2,}|\n(?=[-•\d])/).map((x) => x.trim()).filter((x) => x.length > 2)) sec.paragraphs.push(p);
    } else if (Array.isArray(val) && val.length && typeof val[0] === "object" && val[0] && "type" in (val[0] as object) && "children" in (val[0] as object)) {
      sec.paragraphs.push(...blocksToParagraphs(val));
    } else if (typeof val === "object") {
      const arr = Array.isArray(val) ? val : [val];
      if (arr.some((m) => m && typeof m === "object" && ("url" in (m as object) || "formats" in (m as object)))) media(val);
      else {
        // relations: keep their human-readable names
        const names = arr.map((r) => (r && typeof r === "object" ? Object.entries(r).find(([k, v]) => HEADING_KEYS.test(k) || /^(name|title)$/i.test(k) ? typeof v === "string" : false)?.[1] : undefined)).filter(Boolean);
        if (names.length) sec.bullets.push(`${key}: ${names.join(", ")}`);
      }
    } else if (typeof val === "number" || typeof val === "boolean") {
      /* ordering / flags are not content */
    }
  }
  return sec;
}

async function fromStrapi(spec: string): Promise<ContentSection[]> {
  const baseRaw = process.env.STRAPI_URL;
  if (!baseRaw) throw new Error("strapi: set STRAPI_URL (e.g. http://localhost:1337) and STRAPI_TOKEN (read-only API token) in .env.local or the shell.");
  const base = baseRaw.replace(/\/$/, "");
  const [collection, query = ""] = spec.split("?");
  const params = new URLSearchParams(query);
  const limit = params.get("limit") ?? "25";
  params.delete("limit");
  params.set("pagination[pageSize]", limit);
  params.set("populate", "*");
  const res = await fetch(`${base}/api/${collection}?${params}`, {
    headers: process.env.STRAPI_TOKEN ? { Authorization: `Bearer ${process.env.STRAPI_TOKEN}` } : {},
    signal: AbortSignal.timeout(15000),
  }).catch((e) => {
    throw new Error(`strapi: cannot reach ${base} (${e.message}). Is Strapi running?`);
  });
  if (res.status === 401 || res.status === 403)
    throw new Error(`strapi: HTTP ${res.status} for ${collection}. Create a read-only API token (Strapi admin > Settings > API Tokens) and set STRAPI_TOKEN, or allow "find" for this collection.`);
  if (!res.ok) throw new Error(`strapi: HTTP ${res.status} for ${collection}`);
  const json = (await res.json()) as { data?: Record<string, unknown>[] | Record<string, unknown> };
  const rows = Array.isArray(json.data) ? json.data : json.data ? [json.data] : [];
  return rows.map((r) => entryToSection((r.attributes as Record<string, unknown>) ?? r, collection, base));
}

/* ------------------------------------------------------------------ file */

function fromFile(spec: string): ContentSection[] {
  const file = path.resolve(spec);
  if (!existsSync(file)) throw new Error(`file: ${file} not found`);
  const raw = readFileSync(file, "utf8");
  const source = `file:${path.basename(file)}`;
  if (file.endsWith(".json")) {
    const j = JSON.parse(raw) as { sections?: ContentSection[] } | ContentSection[];
    const list = Array.isArray(j) ? j : (j.sections ?? []);
    return list.map((s) => ({ ...empty(source), ...s, source }));
  }
  const sections: ContentSection[] = [];
  let cur = empty(source);
  const flush = () => {
    if (cur.heading || cur.paragraphs.length || cur.bullets.length || cur.images.length) sections.push(cur);
  };
  const blocks = raw.replace(/\r\n/g, "\n").split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());
    for (const [i, line] of lines.entries()) {
      const h = line.match(/^(#{1,4})\s+(.*)$/);
      const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
      if (h) {
        flush();
        cur = empty(source, h[2].trim(), h[1].length);
      } else if (img) cur.images.push({ src: img[2], alt: img[1] || undefined });
      else if (bullet) cur.bullets.push(stripMarkup(bullet[1]));
      else if (line.trim()) {
        // plain text block: keep paragraphs together
        const rest = lines.slice(i).filter((l) => l.trim() && !/^(#{1,4}\s|\s*[-*•]\s|!\[)/.test(l)).join(" ");
        if (rest) cur.paragraphs.push(stripMarkup(rest));
        break;
      }
    }
  }
  flush();
  return sections;
}

/* ---------------------------------------------------------------- bundle */

export async function loadContent(specs: string[], opts: { headed?: boolean; log?: (m: string) => void } = {}): Promise<ContentBundle> {
  const log = opts.log ?? (() => {});
  const sections: ContentSection[] = [];
  for (const spec of specs) {
    const i = spec.indexOf(":");
    const kind = spec.slice(0, i);
    const rest = spec.slice(i + 1);
    log(`reading ${kind}: ${rest}`);
    if (kind === "live") sections.push(...(await fromLive(rest, !!opts.headed)));
    else if (kind === "strapi") sections.push(...(await fromStrapi(rest)));
    else if (kind === "file") sections.push(...fromFile(rest));
    else throw new Error(`unknown content source "${kind}". Use live:<url>, strapi:<collection>, or file:<path>`);
  }
  if (!sections.length) throw new Error("no content found in the given sources");
  return { createdAt: new Date().toISOString(), sources: specs, sections };
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const out = args.includes("--out") ? args[args.indexOf("--out") + 1] : undefined;
  const specs = args.filter((a, i) => !a.startsWith("--") && args[i - 1] !== "--out");
  if (!specs.length) {
    console.error("Usage: node scripts/factory/content.mts live:<url>[#Heading] | strapi:<collection>[?query] | file:<path> ... [--out content.json] [--headed]");
    process.exit(1);
  }
  try {
    const bundle = await loadContent(specs, { headed: args.includes("--headed"), log: (m) => console.log(m) });
    for (const s of bundle.sections)
      console.log(`- ${(s.heading ?? "(no heading)").slice(0, 60).padEnd(60)} paras=${s.paragraphs.length} bullets=${s.bullets.length} images=${s.images.length}  [${s.source}]`);
    if (out) {
      mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
      writeFileSync(out, JSON.stringify(bundle, null, 2) + "\n");
      console.log(`wrote ${out}`);
    }
  } catch (e) {
    console.error(`\n${(e as Error).message}`);
    process.exitCode = 2; // not process.exit(): avoids a Windows libuv assertion while sockets are closing
  }
}
