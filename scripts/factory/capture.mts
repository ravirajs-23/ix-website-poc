/**
 * Stage 1 — CAPTURE a reference page.
 *
 *   node scripts/factory/capture.mts <url> [--out <dir>] [--max-shots 14] [--headed]
 *
 * Opens the page in headless Chrome (your installed Chrome/Edge via playwright-core, no download),
 * scrolls it so lazy content renders, and writes:
 *   <out>/reference.json   section-by-section structure + measurements (layout only; text is truncated)
 *   <out>/shots/NN.jpg     one screenshot per section (desktop)
 *   <out>/mobile.jpg       full-page mobile screenshot
 *
 * It never clicks anything (cookie banners are only hidden for the screenshots, never accepted).
 * The output describes LAYOUT, tone, scale and behaviour so a page can be re-created on our own theme;
 * it deliberately keeps reference text short so it is not reused as content.
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

export type SectionInfo = {
  index: number;
  tag: string;
  yTop: number;
  height: number;
  background: { kind: "solid" | "image-or-gradient"; tone?: "dark" | "light" | "mid" };
  paddingY: number;
  containerWidth: number;
  headings: { level: string; text: string; fontSize: number; fontWeight: string; align: string; uppercase: boolean }[];
  eyebrow?: string;
  paragraphSample?: string;
  buttons: string[];
  layout: {
    kind: "split-media" | "grid" | "stack" | "carousel" | "hero" | "single-column";
    columns?: number;
    items?: number;
    itemHasImage?: boolean;
    itemHasIcon?: boolean;
    itemHasLink?: boolean;
    mediaSide?: "left" | "right";
    textAlign: string;
  };
  media: { images: number; videos: number; svgs: number; largestImage?: { width: number; height: number; aspect: number } };
  interactions: { tabs: number; accordion: number; carousel: boolean; filters: boolean };
  screenshot?: string;
};

export type ReferenceCapture = {
  url: string;
  title: string;
  capturedAt: string;
  viewport: { width: number; height: number };
  pageHeight: number;
  sections: SectionInfo[];
  mobile?: string;
};

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
];

export function findChrome(): string {
  const found = CHROME_CANDIDATES.find((p) => p && existsSync(p));
  if (!found) throw new Error("No Chrome/Edge found. Install Chrome or set CHROME_PATH to its executable.");
  return found;
}

/** Runs inside the page. Must be self-contained (serialised by Playwright). */
function extractSections(): Omit<SectionInfo, "screenshot">[] {
  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|LINK|TEMPLATE)$/;
  const num = (v: string) => parseFloat(v) || 0;
  const visible = (el: Element) => {
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && (el as HTMLElement).offsetHeight > 0;
  };
  const rgba = (c: string) => (c.match(/[\d.]+/g) ?? ["0", "0", "0", "0"]).map(Number);
  const background = (el: Element) => {
    for (let e: Element | null = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== "none" && !cs.backgroundImage.startsWith("url(\"data:")) return { kind: "image-or-gradient" as const };
      const [r, g, b, a = 1] = rgba(cs.backgroundColor);
      if (a > 0.05) {
        const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        return { kind: "solid" as const, tone: l < 0.4 ? ("dark" as const) : l > 0.8 ? ("light" as const) : ("mid" as const) };
      }
    }
    return { kind: "solid" as const, tone: "light" as const };
  };
  // Children of an element, looking inside an open shadow root if it has one.
  const kidsOf = (el: Element): Element[] => [...(el.shadowRoot ? el.shadowRoot.children : el.children)];
  // Visible, in-flow children. Floating widgets (fixed position, tiny boxes) are ignored.
  const significant = (el: Element) =>
    kidsOf(el).filter((c) => {
      if (SKIP_TAGS.test(c.tagName) || !visible(c)) return false;
      const h = c as HTMLElement;
      return h.offsetHeight > 20 && h.offsetWidth >= 100 && getComputedStyle(c).position !== "fixed";
    });
  // querySelectorAll that also searches inside open shadow roots.
  const qa = (root: Element | ShadowRoot, sel: string): Element[] => {
    const out = [...root.querySelectorAll(sel)];
    const hosts = [...(root instanceof ShadowRoot ? [] : [root]), ...root.querySelectorAll("*")].filter((e) => e.shadowRoot);
    for (const h of hosts) out.push(...qa(h.shadowRoot as ShadowRoot, sel));
    return out;
  };

  // Split the page into sections. Page builders wrap content in many nested divs, so recurse:
  //  - a tall node with ONE visible child is a transparent wrapper: look inside it
  //  - a tall node whose children are FULL-WIDTH and STACKED vertically is a list of sections: split it
  //  - anything else (small node, or children side by side like a card grid) is a single section
  const stacked = (kids: Element[], parent: Element) => {
    const pw = parent.getBoundingClientRect().width;
    const rects = kids.map((k) => k.getBoundingClientRect());
    return rects.every((r) => r.width >= pw * 0.8 && Math.abs(r.left - rects[0].left) < 8);
  };
  const splitInto = (el: Element, depth = 0): Element[] => {
    const h = (el as HTMLElement).offsetHeight;
    const kids = significant(el);
    if (depth > 14 || kids.length === 0) return [el];
    if (kids.length === 1) return h > 700 ? splitInto(kids[0], depth + 1) : [el];
    if (h > 700 && stacked(kids, el)) return kids.flatMap((k) => splitInto(k, depth + 1));
    // Long article beside a narrow sidebar: the sections live in the dominant (tall, wide) column.
    if (h > 1500) {
      const area = (k: Element) => k.getBoundingClientRect().width * (k as HTMLElement).offsetHeight; // sidebars stretch to full height, so compare area
      const main = kids.reduce((a, b) => (area(b) > area(a) ? b : a));
      if ((main as HTMLElement).offsetHeight >= h * 0.8 && main.getBoundingClientRect().width >= el.getBoundingClientRect().width * 0.5) return splitInto(main, depth + 1);
    }
    return [el];
  };
  const root: Element = document.querySelector("main") ?? document.body;
  const candidates = splitInto(root)
    .filter((e) => !/^(HEADER|FOOTER|NAV)$/.test(e.tagName) && !e.closest("header,footer,nav"))
    .filter((e) => (e as HTMLElement).offsetHeight >= 120 && getComputedStyle(e).position !== "fixed");

  return candidates.map((el, index) => {
    (el as HTMLElement).setAttribute("data-factory-id", String(index));
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const text = (e: Element) => (e.textContent ?? "").replace(/\s+/g, " ").trim();

    const headings = [...qa(el, "h1,h2,h3,h4")]
      .filter(visible)
      .slice(0, 8)
      .map((h) => {
        const hs = getComputedStyle(h);
        return {
          level: h.tagName,
          text: text(h).slice(0, 70),
          fontSize: Math.round(num(hs.fontSize)),
          fontWeight: hs.fontWeight,
          align: hs.textAlign,
          uppercase: hs.textTransform === "uppercase",
        };
      });

    // Eyebrow: short, uppercase or letter-spaced text just above the main heading.
    let eyebrow: string | undefined;
    const main = qa(el, "h1,h2")[0];
    const prev = main?.previousElementSibling ?? main?.parentElement?.previousElementSibling;
    if (prev && visible(prev)) {
      const ps = getComputedStyle(prev);
      const t = text(prev);
      if (t.length > 0 && t.length < 40 && (ps.textTransform === "uppercase" || num(ps.letterSpacing) > 1)) eyebrow = t;
    }

    const firstPara = [...qa(el, "p")].find((p) => visible(p) && text(p).length > 40);

    const buttons = [...qa(el, "a,button")]
      .filter((b) => {
        const bs = getComputedStyle(b);
        const t = text(b);
        return visible(b) && t.length > 1 && t.length < 32 && (num(bs.borderRadius) > 3 || bs.borderStyle !== "none" || /btn|button|cta/i.test(String((b as HTMLElement).className)));
      })
      .slice(0, 5)
      .map((b) => text(b));

    // Repeated-sibling grids (cards, features, stats).
    let best: { count: number; cols: number; area: number; node: Element } | undefined;
    for (const node of qa(el, "*")) {
      const kids = [...node.children].filter((k) => visible(k) && (k as HTMLElement).offsetHeight > 40);
      if (kids.length < 3) continue;
      const rects = kids.map((k) => k.getBoundingClientRect());
      const w0 = rects[0].width;
      if (!rects.every((r) => Math.abs(r.width - w0) < w0 * 0.2)) continue;
      const cols = new Set(rects.map((r) => Math.round(r.left / 8))).size;
      const area = rects.reduce((s, r) => s + r.width * r.height, 0);
      if (!best || area > best.area) best = { count: kids.length, cols, area, node };
    }

    // Split media: a big image beside a text block.
    const imgs = [...qa(el, "img,picture,video")].filter(visible);
    const imgRects = imgs.map((i) => ({ r: i.getBoundingClientRect(), el: i }));
    const bigImg = imgRects.filter((x) => x.r.width > rect.width * 0.25).sort((a, b) => b.r.width * b.r.height - a.r.width * a.r.height)[0];
    let mediaSide: "left" | "right" | undefined;
    if (bigImg && headings[0]) {
      const h = qa(el, "h1,h2,h3").find(visible);
      if (h) {
        const hr = h.getBoundingClientRect();
        const sideBySide = bigImg.r.right <= hr.left + 8 || bigImg.r.left >= hr.right - 8;
        if (sideBySide) mediaSide = bigImg.r.left < hr.left ? "left" : "right";
      }
    }

    const hasTabs = qa(el, '[role="tab"]').length;
    const accordion = qa(el, "details, [aria-expanded]").length;
    const scroller = [...qa(el, "*")].some((n) => {
      const s = getComputedStyle(n);
      return (s.overflowX === "auto" || s.overflowX === "scroll") && (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 40 && (n as HTMLElement).clientWidth > 300;
    });
    const carousel = scroller || qa(el, '[class*="swiper"],[class*="slick"],[class*="carousel"],[class*="slider"]').length > 0;
    const filterGroup = [...qa(el, "*")].some((n) => [...n.children].filter((c) => c.tagName === "BUTTON" && c.hasAttribute("aria-pressed")).length >= 4);

    const aligns = headings.map((h) => h.align);
    const textAlign = aligns.length ? (aligns.filter((a) => a === "center").length > aligns.length / 2 ? "center" : "left") : "left";
    const bigImgInfo = bigImg ? { width: Math.round(bigImg.r.width), height: Math.round(bigImg.r.height), aspect: +(bigImg.r.width / bigImg.r.height).toFixed(2) } : undefined;

    let kind: SectionInfo["layout"]["kind"] = "stack";
    if (index === 0 && qa(el, "h1").length > 0) kind = "hero";
    else if (carousel && !best) kind = "carousel";
    else if (mediaSide) kind = "split-media";
    else if (best) kind = "grid";
    else if (!headings.length || headings.length === 1) kind = "single-column";

    return {
      index,
      tag: el.tagName.toLowerCase(),
      yTop: Math.round(rect.top + window.scrollY),
      height: Math.round(rect.height),
      background: background(el),
      paddingY: Math.round((num(cs.paddingTop) + num(cs.paddingBottom)) / 2),
      containerWidth: Math.round(Math.min(rect.width, ...[...el.children].map((c) => c.getBoundingClientRect().width).filter((w) => w > 300))),
      headings,
      eyebrow,
      paragraphSample: firstPara ? text(firstPara).slice(0, 110) : undefined,
      buttons,
      layout: {
        kind,
        columns: best?.cols,
        items: best?.count,
        itemHasImage: best ? !!best.node.children[0]?.querySelector("img") : undefined,
        itemHasIcon: best ? !!best.node.children[0]?.querySelector("svg") : undefined,
        itemHasLink: best ? !!best.node.children[0]?.querySelector("a") : undefined,
        mediaSide,
        textAlign,
      },
      media: {
        images: qa(el, "img,picture").length,
        videos: qa(el, "video,iframe").length,
        svgs: qa(el, "svg").length,
        largestImage: bigImgInfo,
      },
      interactions: { tabs: hasTabs, accordion, carousel, filters: filterGroup },
    };
  });
}

export class ReferenceBlockedError extends Error {}

/** Detect block pages / bot challenges. We never try to get around them; we stop and explain. */
function assertNotBlocked(status: number | undefined, title: string, bodyStart: string, headed: boolean) {
  const blocked = (status !== undefined && status >= 400) || /access denied|forbidden|attention required|just a moment|are you a robot|captcha|request blocked/i.test(title + " " + bodyStart);
  if (!blocked) return;
  const lines = [
    `The reference site refused the automated browser (HTTP ${status ?? "?"}, title "${title}").`,
    headed
      ? "It is blocking even a normal visible browser session; the tool does not try to get around bot protection."
      : "Some sites block headless browsers. Re-run with --headed to use a normal, visible Chrome window (no evasion techniques are used).",
    "Alternatives: use the /new-page or /add-section skill in Claude Code (it browses interactively), or give the tool screenshots with --images <dir>.",
  ];
  throw new ReferenceBlockedError(lines.join("\n"));
}

export async function capture(
  url: string,
  outDir: string,
  opts: { maxShots?: number; headed?: boolean; log?: (m: string) => void } = {},
): Promise<ReferenceCapture> {
  const log = opts.log ?? (() => {});
  mkdirSync(path.join(outDir, "shots"), { recursive: true });
  const browser = await chromium.launch({ executablePath: findChrome(), headless: !opts.headed });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    log(`opening ${url}`);
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(1500);
    assertNotBlocked(response?.status(), await page.title(), (await page.evaluate(() => document.body?.innerText ?? "")).slice(0, 200), !!opts.headed);
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    // Hide (never accept) consent banners and chat widgets so they do not cover screenshots.
    await page.addStyleTag({
      content: `[id*="cookie" i],[class*="cookie" i],[id*="consent" i],[class*="consent" i],[class*="onetrust" i],[id*="onetrust" i],[class*="chat-widget" i],iframe[title*="chat" i]{display:none !important}`,
    });
    // Scroll through so lazy/scroll-driven content renders.
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((yy) => window.scrollTo(0, yy), y);
      await page.waitForTimeout(120);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(600);

    const sections = (await page.evaluate(extractSections)) as SectionInfo[];
    log(`found ${sections.length} sections`);

    const max = opts.maxShots ?? 14;
    for (const s of sections.slice(0, max)) {
      const file = `shots/${String(s.index).padStart(2, "0")}.jpg`;
      try {
        const loc = page.locator(`[data-factory-id="${s.index}"]`);
        await loc.scrollIntoViewIfNeeded();
        await page.waitForTimeout(350);
        await loc.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 55, timeout: 8000 });
        s.screenshot = file;
      } catch {
        /* a section that cannot be screenshotted (sticky/animated) is still described */
      }
    }

    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, deviceScaleFactor: 1 });
    const mp = await mobile.newPage();
    await mp.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => {});
    await mp.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const mh = await mp.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Math.min(mh, 9000); y += 500) {
      await mp.evaluate((yy) => window.scrollTo(0, yy), y);
      await mp.waitForTimeout(100);
    }
    await mp.evaluate(() => window.scrollTo(0, 0));
    await mp.screenshot({ path: path.join(outDir, "mobile.jpg"), type: "jpeg", quality: 40, fullPage: true, timeout: 20000 }).catch(() => {});

    const result: ReferenceCapture = {
      url,
      title: await page.title(),
      capturedAt: new Date().toISOString(),
      viewport: { width: 1440, height: 900 },
      pageHeight: height,
      sections,
      mobile: existsSync(path.join(outDir, "mobile.jpg")) ? "mobile.jpg" : undefined,
    };
    writeFileSync(path.join(outDir, "reference.json"), JSON.stringify(result, null, 2) + "\n");
    return result;
  } finally {
    await browser.close();
  }
}

// CLI
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const url = args.find((a) => /^https?:/.test(a));
  const flag = (n: string) => {
    const i = args.indexOf(`--${n}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  if (!url) {
    console.error("Usage: node scripts/factory/capture.mts <url> [--out <dir>] [--max-shots 14] [--headed]");
    process.exit(1);
  }
  const out = flag("out") ?? path.join(".factory", "capture-" + new URL(url).hostname.replace(/^www\./, ""));
  let res;
  try {
    res = await capture(url, out, { maxShots: Number(flag("max-shots") ?? 14), headed: args.includes("--headed"), log: (m) => console.log(m) });
  } catch (e) {
    if (e instanceof ReferenceBlockedError) {
      console.error(`\n${e.message}`);
      process.exit(2);
    }
    throw e;
  }
  for (const s of res.sections) {
    const l = s.layout;
    console.log(
      `${String(s.index).padStart(2)} ${l.kind.padEnd(12)} ${String(s.height).padStart(5)}px ${(s.background.tone ?? s.background.kind).padEnd(5)} cols=${l.columns ?? "-"} items=${l.items ?? "-"} ${l.mediaSide ? "media:" + l.mediaSide : ""} | ${s.headings[0]?.text ?? ""}`,
    );
  }
  console.log(`\nwrote ${path.join(out, "reference.json")} (+ ${res.sections.filter((s) => s.screenshot).length} screenshots)`);
}
