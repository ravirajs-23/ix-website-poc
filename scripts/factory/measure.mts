/**
 * Measure a running site: Lighthouse (median of N runs) + deterministic on-page SEO facts + site-level SEO files.
 *
 * Lighthouse performance scores move by +-10..15 points with machine load, so every page is measured N times
 * (default 3) and the MEDIAN is used; the report also shows page weight, script bytes and DOM size, which do not
 * depend on machine load. Accessibility / best-practices / SEO scores are stable.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";
import { findChrome } from "./capture.mts";

export type RunMetrics = {
  perf: number;
  a11y: number;
  bp: number;
  seo: number;
  fcp: number;
  lcp: number;
  tbt: number;
  cls: number;
  si: number;
  bytes: number;
  scriptBytes: number;
  dom: number;
  requests: number;
};

export type StaticSeo = {
  title: string;
  titleLength: number;
  description: string;
  descriptionLength: number;
  h1Count: number;
  canonical: string | null;
  robotsMeta: string | null;
  jsonLdTypes: string[];
  headings: { level: number; text: string }[];
  images: { total: number; withAlt: number };
  links: { internal: number; external: number };
  wordCount: number;
  sections: number;
};

export type PageMetrics = { path: string; runs: RunMetrics[]; median: RunMetrics; seo: StaticSeo };
export type SiteMetrics = { sitemapUrls: number; llmsEntries: number; robotsAllowsAiCrawlers: number; robotsBlocksAll: boolean; pageCount: number };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

function lighthouseOnce(url: string, log: (m: string) => void): RunMetrics {
  const dir = path.join(os.tmpdir(), "ix-factory-lh");
  mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `lh-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.json`);
  // One command string (not an args array) so Node does not warn about unescaped shell arguments.
  const cmd = `npx --yes lighthouse@12 "${url}" --chrome-flags=--headless=new --only-categories=performance,accessibility,seo,best-practices --output=json --output-path="${out}" --quiet`;
  const r = spawnSync(cmd, { encoding: "utf8", shell: true, env: { ...process.env, CHROME_PATH: findChrome() }, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`lighthouse failed for ${url}: ${(r.stderr || r.stdout).trim().split("\n").slice(-4).join(" | ")}`);
  const j = JSON.parse(readFileSync(out, "utf8"));
  rmSync(out, { force: true });
  const a = j.audits;
  const c = j.categories;
  const scripts = (a["resource-summary"]?.details?.items ?? []).find((i: { resourceType: string }) => i.resourceType === "script");
  const m: RunMetrics = {
    perf: Math.round(c.performance.score * 100),
    a11y: Math.round(c.accessibility.score * 100),
    bp: Math.round(c["best-practices"].score * 100),
    seo: Math.round(c.seo.score * 100),
    fcp: a["first-contentful-paint"].numericValue,
    lcp: a["largest-contentful-paint"].numericValue,
    tbt: a["total-blocking-time"].numericValue,
    cls: a["cumulative-layout-shift"].numericValue,
    si: a["speed-index"].numericValue,
    bytes: a["total-byte-weight"].numericValue,
    scriptBytes: scripts?.transferSize ?? 0,
    dom: a["dom-size"].numericValue,
    requests: a["network-requests"]?.details?.items?.length ?? 0,
  };
  log(`  lighthouse: perf ${m.perf} a11y ${m.a11y} bp ${m.bp} seo ${m.seo}`);
  return m;
}

const medianOf = (runs: RunMetrics[]): RunMetrics => {
  const keys = Object.keys(runs[0]) as (keyof RunMetrics)[];
  return Object.fromEntries(keys.map((k) => [k, median(runs.map((r) => r[k]))])) as RunMetrics;
};

async function staticSeo(url: string): Promise<StaticSeo> {
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 45000 }).catch(() => {});
    return await page.evaluate(() => {
      const meta = (n: string) => document.querySelector(`meta[name="${n}"]`)?.getAttribute("content") ?? null;
      const types: string[] = [];
      for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
        try {
          const j = JSON.parse(s.textContent ?? "{}");
          for (const n of Array.isArray(j) ? j : [j]) if (n && n["@type"]) types.push(String(n["@type"]));
        } catch {
          /* ignore invalid JSON-LD (it would be a finding) */
        }
      }
      const imgs = [...document.querySelectorAll("img")];
      const links = [...document.querySelectorAll("a[href]")].map((a) => (a as HTMLAnchorElement).href);
      const main = document.querySelector("main") ?? document.body;
      return {
        title: document.title,
        titleLength: document.title.length,
        description: meta("description") ?? "",
        descriptionLength: (meta("description") ?? "").length,
        h1Count: document.querySelectorAll("h1").length,
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null,
        robotsMeta: meta("robots"),
        jsonLdTypes: types,
        headings: [...document.querySelectorAll("main h1, main h2, main h3")].slice(0, 40).map((h) => ({ level: Number(h.tagName[1]), text: (h.textContent ?? "").replace(/\s+/g, " ").trim().slice(0, 80) })),
        images: { total: imgs.length, withAlt: imgs.filter((i) => i.hasAttribute("alt")).length },
        links: { internal: links.filter((l) => l.startsWith(location.origin)).length, external: links.filter((l) => !l.startsWith(location.origin)).length },
        wordCount: ((main as HTMLElement).innerText ?? "").split(/\s+/).filter(Boolean).length,
        sections: main.querySelectorAll("section").length,
      };
    });
  } finally {
    await browser.close();
  }
}

export async function measurePage(base: string, pagePath: string, opts: { runs?: number; log?: (m: string) => void } = {}): Promise<PageMetrics> {
  const log = opts.log ?? (() => {});
  const url = `${base}${pagePath}`;
  log(`measuring ${pagePath} (${opts.runs ?? 3} Lighthouse runs + on-page checks)`);
  const runs: RunMetrics[] = [];
  for (let i = 0; i < (opts.runs ?? 3); i++) runs.push(lighthouseOnce(url, log));
  return { path: pagePath, runs, median: medianOf(runs), seo: await staticSeo(url) };
}

export async function measureSite(base: string): Promise<SiteMetrics> {
  const text = async (p: string) => (await fetch(`${base}${p}`).then((r) => (r.ok ? r.text() : "")).catch(() => ""));
  const sitemap = await text("/sitemap.xml");
  const llms = await text("/llms.txt");
  const robots = await text("/robots.txt");
  const sitemapUrls = (sitemap.match(/<loc>/g) ?? []).length;
  return {
    sitemapUrls,
    llmsEntries: (llms.match(/^- \[/gm) ?? []).length,
    robotsAllowsAiCrawlers: (robots.match(/User-Agent: (GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|CCBot|Bytespider|Amazonbot|cohere-ai|Meta-ExternalAgent|DuckAssistBot)/gi) ?? []).length,
    robotsBlocksAll: /User-Agent: \*\s*\r?\nDisallow: \/\s*(\r?\n|$)/i.test(robots),
    pageCount: sitemapUrls,
  };
}
