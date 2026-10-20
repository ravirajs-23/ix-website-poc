/**
 * Screenshots of a page of the built site, at desktop and phone width (for review in chat).
 * Uses the production build in .next (builds it first if missing) on a private port.
 */
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { findChrome } from "./capture.mts";
import { buildSite, startServer } from "./serve.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

export async function takeShots(opts: { pagePath: string; outDir: string; port?: number; rebuild?: boolean; log?: (m: string) => void }): Promise<string[]> {
  const log = opts.log ?? (() => {});
  const out = path.resolve(root, opts.outDir);
  mkdirSync(out, { recursive: true });
  if (opts.rebuild || !existsSync(path.join(root, ".next", "BUILD_ID"))) buildSite(log);
  const server = await startServer(opts.port ?? 3198, log);
  const browser = await chromium.launch({ executablePath: findChrome(), headless: true });
  const slug = opts.pagePath === "/" ? "home" : opts.pagePath.replace(/^\/|\/$/g, "").replace(/\//g, "-");
  const files: string[] = [];
  try {
    for (const [name, width, height, mobile] of [
      ["desktop", 1440, 900, false],
      ["phone", 390, 844, true],
    ] as const) {
      const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
      const page = await ctx.newPage();
      await page.goto(`${server.url}${opts.pagePath}`, { waitUntil: "networkidle", timeout: 60_000 });
      // Scroll through the page so lazy images load and reveal animations run, then back to the top.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      const file = path.join(out, `${slug}-${name}.jpg`);
      await page.screenshot({ path: file, fullPage: true, type: "jpeg", quality: 70 });
      files.push(file);
      await ctx.close();
    }
  } finally {
    await browser.close();
    server.stop();
  }
  return files;
}
