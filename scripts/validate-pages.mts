/**
 * Validates every src/content/pages/*.json.  Run:  npm run validate:pages   (also runs before `npm run build`)
 *
 * ERRORS (exit 1): schema violations (unknown/missing props, wrong enums), file name vs path mismatch,
 * duplicate paths, not exactly one hero as the first block, placeholder text (TODO/lorem), broken internal
 * links/anchors, images from hosts next/image is not configured for.
 * WARNINGS (exit 0): SEO length hints, missing `reference` provenance, unknown case-study/job slugs
 * (they may live in Strapi).
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageSchema, type PageDefinition } from "../src/blocks/schema.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pagesDir = path.join(root, "src", "content", "pages");

type Finding = { level: "error" | "warn"; file: string; msg: string };
const findings: Finding[] = [];
const add = (level: Finding["level"], file: string, msg: string) => findings.push({ level, file, msg });

// Hosts next/image may load from (parsed from next.config.ts so there is one source of truth).
const nextConfig = readFileSync(path.join(root, "next.config.ts"), "utf8");
const imageHosts = [...nextConfig.matchAll(/hostname:\s*"([^"]+)"/g)].map((m) => m[1]);

const readJson = <T,>(rel: string): T | null => {
  const p = path.join(root, rel);
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as T) : null;
};
const caseSlugs = new Set((readJson<{ slug: string }[]>("src/content/data/case-studies.json") ?? []).map((c) => c.slug));
const jobSlugs = new Set((readJson<{ slug: string }[]>("src/content/data/jobs.json") ?? []).map((j) => j.slug));

const files = readdirSync(pagesDir).filter((f) => f.endsWith(".json")).sort();
const pages = new Map<string, PageDefinition>();
const parsed: { file: string; page: PageDefinition }[] = [];

for (const file of files) {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path.join(pagesDir, file), "utf8"));
  } catch (e) {
    add("error", file, `Invalid JSON: ${(e as Error).message}`);
    continue;
  }
  const scan = (n: unknown): void => {
    if (typeof n === "string") {
      if (/(?<![A-Za-z])(TODO|TBD|lorem ipsum|FIXME)(?![A-Za-z])/i.test(n)) add("error", file, `placeholder text left in: "${n.slice(0, 60)}"`);
    } else if (n && typeof n === "object") Object.values(n).forEach(scan);
  };
  scan(raw);
  const res = pageSchema.safeParse(raw);
  if (!res.success) {
    for (const issue of res.error.issues) add("error", file, `${issue.path.join(".") || "(root)"}: ${issue.message}`);
    continue;
  }
  parsed.push({ file, page: res.data });
}

for (const { file, page } of parsed) {
  const slug = file.replace(/\.json$/, "");
  const expected = slug === "home" ? "/" : `/${slug}`;
  if (page.path !== expected) add("error", file, `path "${page.path}" must be "${expected}" to match the file name`);
  if (pages.has(page.path)) add("error", file, `duplicate path ${page.path}`);
  pages.set(page.path, page);
}

const walk = (node: unknown, visit: (key: string, value: unknown, parent: Record<string, unknown>) => void) => {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit));
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      visit(k, v, node as Record<string, unknown>);
      walk(v, visit);
    }
  }
};

for (const { file, page } of parsed) {
  // Exactly one hero, first: it renders the page's only <h1>.
  const heroes = page.blocks.filter((b) => b.type === "hero").length;
  if (heroes !== 1 || page.blocks[0].type !== "hero") add("error", file, "page needs exactly one hero block, as the first block (it renders the only <h1>)");

  // SEO hints.
  if (page.seo.title.length > 70) add("warn", file, `seo.title is ${page.seo.title.length} chars (aim for <= 60)`);
  if (page.seo.description.length > 170) add("warn", file, `seo.description is ${page.seo.description.length} chars (aim for 120-160)`);
  if (!page.reference) add("warn", file, "no `reference` (provenance of the layout) set");

  // Anchors defined on this page (the jobs block renders id="openings").
  const anchors = new Set<string>(["openings"].filter(() => page.blocks.some((b) => b.type === "jobs")));
  for (const b of page.blocks) if (b.anchor) anchors.add(b.anchor);

  walk(page.blocks, (k, v) => {
    if (k === "href" && typeof v === "string") {
      if (/^(https?:|mailto:|tel:)/.test(v)) return;
      if (v.startsWith("#")) {
        if (!anchors.has(v.slice(1))) add("error", file, `link "${v}" has no matching anchor on this page`);
        return;
      }
      const target = v.split(/[?#]/)[0];
      if (pages.has(target)) return;
      const m = target.match(/^\/(work|careers)\/([^/]+)$/);
      if (m) {
        const known = m[1] === "work" ? caseSlugs : jobSlugs;
        if (!known.has(m[2])) add("warn", file, `link "${v}": slug not in local data (fine if it lives in Strapi)`);
        return;
      }
      add("error", file, `internal link "${v}" does not match any page`);
    }
    if (k === "src" && typeof v === "string") {
      if (v.startsWith("/")) return;
      try {
        const host = new URL(v).hostname;
        if (!imageHosts.includes(host)) add("error", file, `image host "${host}" is not allowed in next.config.ts images.remotePatterns (allowed: ${imageHosts.join(", ")})`);
      } catch {
        add("error", file, `image src "${v}" is not a valid URL or /public path`);
      }
    }
  });
}

const errors = findings.filter((f) => f.level === "error");
const warns = findings.filter((f) => f.level === "warn");
for (const f of [...errors, ...warns]) console.log(`${f.level === "error" ? "ERROR" : "warn "}  ${f.file}  ${f.msg}`);
console.log(`\nvalidate:pages — ${files.length} page file(s), ${errors.length} error(s), ${warns.length} warning(s)`);
process.exit(errors.length ? 1 : 0);
