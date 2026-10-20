/**
 * Before/after impact report (markdown; posted as a pull-request comment and saved in the run folder).
 */
import type { GroundingResult } from "./ground.mts";
import { groundingReport } from "./ground.mts";
import type { PageMetrics, SiteMetrics } from "./measure.mts";

export type Snapshot = { pages: PageMetrics[]; site: SiteMetrics };
export type ReportInput = {
  mode: "page" | "section" | "edit";
  title: string;
  targetPath: string; // "/services" or "/careers"
  /** Layout reference and content sources: set for page/section generation, absent for edits. */
  referenceUrl?: string;
  refSection?: string;
  contentSpecs?: string[];
  /** edit mode: plain-language before/after lines. */
  preview?: string[];
  engine: string;
  filesChanged: string[];
  description: string; // e.g. "new page /services" or "1 block(s) after the 'Why join' section"
  before?: Snapshot;
  after?: Snapshot;
  grounding: GroundingResult;
  warnings: string[];
  runs: number;
  runFolder: string;
};

const NOISE_PERF = 8; // Lighthouse performance varies by about this much between identical runs
const WEIGHT = { warnPct: 0.05, minAbs: 10 * 1024 }; // bytes: a change matters only if >= 5% AND >= 10 KB
const kb = (b: number) => `${Math.round(b / 1024)} KB`;
const ms = (v: number) => `${(v / 1000).toFixed(1)} s`;

type RowOpts = {
  better?: "higher" | "lower";
  fmt?: (n: number) => string;
  /** Changes this small are run-to-run noise (e.g. Lighthouse timing). */
  noise?: number;
  /** A change only counts (✅ / ⚠️) if it is at least this share of the "before" value AND at least `minAbs`. */
  warnPct?: number;
  minAbs?: number;
};

/** Is the change big enough to matter? Scores (no thresholds) always matter. */
const material = (b: number, d: number, o: RowOpts) => (o.warnPct === undefined || Math.abs(d) >= Math.abs(b) * o.warnPct) && Math.abs(d) >= (o.minAbs ?? 0);

function row(label: string, b: number | string | undefined, a: number | string | undefined, opts: RowOpts = {}) {
  const f = (v: number | string | undefined) => (v === undefined ? "—" : typeof v === "number" && opts.fmt ? opts.fmt(v) : String(v));
  if (typeof b !== "number" || typeof a !== "number") return `| ${label} | ${f(b)} | ${f(a)} | |`;
  const d = a - b;
  let mark = "";
  if (Math.abs(d) > 1e-9 && opts.better) {
    const good = opts.better === "higher" ? d > 0 : d < 0;
    if (opts.noise !== undefined && Math.abs(d) <= opts.noise) mark = "≈ noise";
    else if (!material(b, d, opts)) mark = "≈ negligible";
    else mark = good ? "✅" : "⚠️";
  }
  const mag = opts.fmt ? opts.fmt(Math.abs(d)) : "";
  // A change that rounds to zero ("0 KB") shows as ±0, never "−0".
  const sign = /^0(\D|$)/.test(mag) ? "±" : d > 0 ? "+" : d < 0 ? "−" : "";
  const delta = opts.fmt ? sign + mag : `${d > 0 ? "+" : ""}${Math.round(d * 100) / 100}`;
  return `| ${label} | ${f(b)} | ${f(a)} | ${d === 0 ? "no change" : delta} ${mark} |`;
}

function pageTable(b: PageMetrics | undefined, a: PageMetrics, bLabel: string) {
  const bm = b?.median;
  const am = a.median;
  return [
    `| Metric | ${bLabel} | After | Change |`,
    "|---|---|---|---|",
    row("Lighthouse performance", bm?.perf, am.perf, { better: "higher", noise: NOISE_PERF }),
    row("Lighthouse accessibility", bm?.a11y, am.a11y, { better: "higher" }),
    row("Lighthouse best practices", bm?.bp, am.bp, { better: "higher" }),
    row("Lighthouse SEO", bm?.seo, am.seo, { better: "higher" }),
    row("Largest contentful paint", bm?.lcp, am.lcp, { better: "lower", fmt: ms, noise: 700 }),
    row("Total blocking time", bm?.tbt, am.tbt, { better: "lower", fmt: (n) => `${Math.round(n)} ms`, noise: 150 }),
    row("Cumulative layout shift", bm?.cls !== undefined ? Math.round(bm.cls * 1000) / 1000 : undefined, Math.round(am.cls * 1000) / 1000, { better: "lower" }),
    row("Page weight (transferred)", bm?.bytes, am.bytes, { better: "lower", fmt: kb, ...WEIGHT }),
    row("JavaScript (transferred)", bm?.scriptBytes, am.scriptBytes, { better: "lower", fmt: kb, ...WEIGHT }),
    row("DOM nodes", bm?.dom, am.dom, { better: "lower", warnPct: 0.05, minAbs: 25 }),
    row("Network requests", bm?.requests, am.requests, { better: "lower", warnPct: 0.1, minAbs: 2 }),
    row("Words on page", b?.seo.wordCount, a.seo.wordCount),
    row("Sections", b?.seo.sections, a.seo.sections),
    row("Headings (h1–h3)", b?.seo.headings.length, a.seo.headings.length),
    row("H1 count (must be 1)", b?.seo.h1Count, a.seo.h1Count),
    row("Images with alt text", b ? `${b.seo.images.withAlt}/${b.seo.images.total}` : undefined, `${a.seo.images.withAlt}/${a.seo.images.total}`),
    row("Structured data types", b ? b.seo.jsonLdTypes.length : undefined, a.seo.jsonLdTypes.length, { better: "higher" }),
    row("Internal links", b?.seo.links.internal, a.seo.links.internal),
  ].join("\n");
}

function verdict(input: ReportInput, before: PageMetrics | undefined, after: PageMetrics, siteB?: SiteMetrics, siteA?: SiteMetrics): string[] {
  const out: string[] = [];
  const a = after.median;
  const b = before?.median;
  const stable = (name: string, bv: number | undefined, av: number) => {
    if (bv === undefined) out.push(`${name} is ${av} on the new page.`);
    else if (av < bv) out.push(`⚠️ ${name} dropped from ${bv} to ${av} — look at the Lighthouse details before merging.`);
    else if (av > bv) out.push(`✅ ${name} improved from ${bv} to ${av}.`);
    else out.push(`${name} unchanged at ${av}.`);
  };
  stable("SEO score", b?.seo, a.seo);
  stable("Accessibility score", b?.a11y, a.a11y);
  stable("Best-practices score", b?.bp, a.bp);
  if (b) {
    const d = a.perf - b.perf;
    out.push(Math.abs(d) <= NOISE_PERF ? `Performance ${b.perf} → ${a.perf}: within normal measurement noise (±${NOISE_PERF}); compare page weight and script size below for the real cost.` : d < 0 ? `⚠️ Performance dropped ${b.perf} → ${a.perf} (more than measurement noise).` : `✅ Performance improved ${b.perf} → ${a.perf}.`);
    const w = a.bytes - b.bytes;
    out.push(
      material(b.bytes, w, WEIGHT)
        ? `${w > 0 ? "⚠️ Page weight grew" : "✅ Page weight shrank"} by ${kb(Math.abs(w))} (${kb(b.bytes)} → ${kb(a.bytes)}).`
        : `Page weight essentially unchanged (${w >= 0 ? "+" : "−"}${kb(Math.abs(w))}: ${kb(b.bytes)} → ${kb(a.bytes)}).`,
    );
  } else out.push(`Performance on the new page: ${a.perf} (page weight ${kb(a.bytes)}, ${a.requests} requests).`);
  if (after.seo.h1Count !== 1) out.push(`⚠️ The page has ${after.seo.h1Count} H1 elements (should be exactly 1).`);
  if (after.seo.images.total > after.seo.images.withAlt) out.push(`⚠️ ${after.seo.images.total - after.seo.images.withAlt} image(s) have no alt attribute.`);
  if (siteB && siteA) {
    if (siteA.sitemapUrls > siteB.sitemapUrls) out.push(`✅ sitemap.xml lists ${siteA.sitemapUrls - siteB.sitemapUrls} more URL(s) (${siteB.sitemapUrls} → ${siteA.sitemapUrls}).`);
    if (siteA.llmsEntries > siteB.llmsEntries) out.push(`✅ llms.txt lists ${siteA.llmsEntries - siteB.llmsEntries} more entr${siteA.llmsEntries - siteB.llmsEntries === 1 ? "y" : "ies"} for AI assistants (${siteB.llmsEntries} → ${siteA.llmsEntries}).`);
  }
  return out;
}

export function renderReport(input: ReportInput): string {
  const { before, after } = input;
  const target = after?.pages.find((p) => p.path === input.targetPath);
  const beforeTarget = before?.pages.find((p) => p.path === input.targetPath);
  const L: string[] = [];
  L.push(`## Page factory report — ${input.mode === "page" ? "new page" : input.mode === "section" ? "new section" : "change"}: ${input.title}`);
  L.push("");
  L.push(`- **Result:** ${input.description}`);
  if (input.referenceUrl) L.push(`- **Reference (layout only):** ${input.referenceUrl}${input.refSection ? ` — section “${input.refSection}”` : ""}`);
  if (input.contentSpecs?.length) L.push(`- **Content sources:** ${input.contentSpecs.map((c) => `\`${c}\``).join(", ")}`);
  L.push(`- **${input.mode === "edit" ? "Made by" : "Generated by"}:** ${input.engine}  ·  **Files changed:** ${input.filesChanged.map((f) => `\`${f}\``).join(", ") || "none"}`);
  L.push("");
  if (input.preview?.length) {
    L.push("### What changed");
    L.push("");
    for (const l of input.preview) L.push(`- ${l}`);
    L.push("");
  }

  if (target) {
    L.push(`### SEO and performance impact${input.mode !== "page" ? ` — \`${input.targetPath}\`` : ""}`);
    L.push("");
    for (const v of verdict(input, beforeTarget, target, before?.site, after?.site)) L.push(`- ${v}`);
    L.push("");
    if (input.mode !== "page") {
      L.push(pageTable(beforeTarget, target, "Before"));
    } else {
      L.push(`New page \`${input.targetPath}\` (did not exist before):`);
      L.push("");
      L.push(pageTable(undefined, target, "Before"));
      const base = before?.pages.find((p) => p.path === "/");
      const baseAfter = after?.pages.find((p) => p.path === "/");
      if (base && baseAfter) {
        L.push("");
        L.push("Existing page for comparison (home) — confirms the new page did not hurt it:");
        L.push("");
        L.push(pageTable(base, baseAfter, "Before"));
      }
    }
    L.push("");
    if (before && after) {
      L.push("### Site-level SEO files");
      L.push("");
      L.push("| Item | Before | After | Change |");
      L.push("|---|---|---|---|");
      L.push(row("URLs in sitemap.xml", before.site.sitemapUrls, after.site.sitemapUrls, { better: "higher" }));
      L.push(row("Entries in llms.txt", before.site.llmsEntries, after.site.llmsEntries, { better: "higher" }));
      L.push(row("AI crawlers explicitly allowed (robots.txt)", before.site.robotsAllowsAiCrawlers, after.site.robotsAllowsAiCrawlers));
      L.push("");
    }
    if (target.seo.headings.length) {
      L.push("<details><summary>Heading outline of the page (after)</summary>");
      L.push("");
      for (const h of target.seo.headings) L.push(`${"  ".repeat(h.level - 1)}- h${h.level}: ${h.text}`);
      L.push("");
      L.push("</details>");
      L.push("");
    }
    L.push(`**On-page facts (after):** title “${target.seo.title}” (${target.seo.titleLength} chars) · description ${target.seo.descriptionLength} chars · canonical ${target.seo.canonical ? "set" : "MISSING"} · robots ${target.seo.robotsMeta ?? "indexable (no robots meta)"} · structured data: ${target.seo.jsonLdTypes.join(", ") || "none"}`);
    L.push("");
  } else {
    L.push("### SEO and performance impact");
    L.push("");
    L.push("_Measurement was skipped for this run._");
    L.push("");
  }

  if (input.mode !== "edit") {
    L.push("### Content integrity");
    L.push("");
    L.push("```");
    L.push(groundingReport(input.grounding));
    L.push("```");
    L.push("");
  }
  if (input.warnings.length) {
    L.push("### Validator warnings");
    L.push("");
    for (const w of input.warnings) L.push(`- ${w}`);
    L.push("");
  }
  L.push("### How this was measured");
  L.push("");
  L.push(`Local production build, Lighthouse (mobile emulation, throttled) — **median of ${input.runs} runs** per page, before and after on the same machine. Performance scores vary by about ±${NOISE_PERF} points between identical runs depending on machine load, so treat small performance changes as noise and rely on page weight, script size and DOM size, which do not. Accessibility, SEO and best-practices scores are deterministic. Run folder: \`${input.runFolder}\`.`);
  L.push("");
  L.push("<sub>Generated by the page factory (`npm run factory`).</sub>");
  return L.join("\n");
}

/**
 * The short, plain-language verdict for non-technical readers: at most three lines, no jargon.
 * (The full tables stay in the report and in the pull-request comment.)
 */
export function shortVerdict(input: ReportInput): string[] {
  const out: string[] = [];
  const after = input.after?.pages.find((p) => p.path === input.targetPath);
  const before = input.before?.pages.find((p) => p.path === input.targetPath);
  if (!input.after || !after) {
    out.push(input.after ? "The page is gone from the site, so there is no score to compare." : "The SEO and speed check was skipped, so there are no scores to compare.");
    return out;
  }
  const a = after.median;
  const b = before?.median;
  const word = (name: string, bv: number | undefined, av: number) => (bv === undefined ? `${name} ${av}` : av === bv ? `${name} stayed at ${av}` : av > bv ? `${name} improved ${bv} → ${av}` : `${name} dropped ${bv} → ${av}`);
  const scores = [word("SEO", b?.seo, a.seo), word("accessibility", b?.a11y, a.a11y)];
  const bad = b && (a.seo < b.seo || a.a11y < b.a11y);
  out.push(`${bad ? "⚠️ " : "✅ "}${scores.join(" · ")}.`);
  if (b) {
    const w = a.bytes - b.bytes;
    const big = Math.abs(w) >= Math.abs(b.bytes) * WEIGHT.warnPct && Math.abs(w) >= WEIGHT.minAbs;
    out.push(big ? `${w > 0 ? "⚠️ The page got heavier" : "✅ The page got lighter"} by ${kb(Math.abs(w))} (${kb(b.bytes)} → ${kb(a.bytes)}).` : `✅ The page's size is about the same (${kb(a.bytes)}).`);
  } else out.push(`The new page weighs ${kb(a.bytes)} and loads ${a.requests} files.`);
  const flags = [after.seo.h1Count !== 1 ? `${after.seo.h1Count} main headings (should be 1)` : "", after.seo.images.total > after.seo.images.withAlt ? "a photo has no description" : ""].filter(Boolean);
  out.push(flags.length ? `⚠️ Needs a look: ${flags.join("; ")}.` : "✅ Search-engine basics are intact (one main heading, every photo described).");
  return out.slice(0, 3);
}
