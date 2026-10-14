/**
 * Downloads every case-study image, re-encodes it as a compressed WebP with a NEUTRAL file name
 * (cs-<hash>.webp) and rewrites src/content/data/case-studies.json to the local /case-studies/... path.
 *
 * Why: the CMS file names embed internal project / client names (e.g. "<Client>_cover_1a2b.webp"). Those names
 * must not appear in this (public) repo or in the deployed site's HTML. Re-encoding also strips any metadata
 * and any text/ids embedded in SVG sources.
 *
 *   node scripts/localize-case-images.mjs
 *
 * Needs `sharp` (installed with Next). Idempotent: already-local paths are left alone. If an image cannot be
 * fetched its `image` field is cleared (the card falls back to the gradient) — a remote URL is never kept.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataFile = path.join(root, "src", "content", "data", "case-studies.json");
const outDir = path.join(root, "public", "case-studies");
const mapDir = path.resolve(root, "..", "content", "_source"); // outside the repo: url -> local path (holds the real names)
mkdirSync(outDir, { recursive: true });

const items = JSON.parse(readFileSync(dataFile, "utf8"));
const remote = [...new Set(items.map((c) => c.image).filter((u) => typeof u === "string" && /^https?:/.test(u)))];
const urlToLocal = new Map();
const failures = [];

async function fetchBuffer(url) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
}

async function localize(url) {
  const name = `cs-${createHash("sha1").update(url).digest("hex").slice(0, 10)}.webp`;
  const dest = path.join(outDir, name);
  if (!existsSync(dest)) {
    const input = await fetchBuffer(url);
    const isSvg = /\.svg(\?|$)/i.test(url) || input.subarray(0, 300).toString("utf8").includes("<svg");
    await sharp(input, isSvg ? { density: 144 } : {})
      .resize({ width: 1200, withoutEnlargement: !isSvg })
      .webp({ quality: 76 })
      .toFile(dest); // sharp drops EXIF/XMP/ICC by default
  }
  urlToLocal.set(url, `/case-studies/${name}`);
}

// Small pool: be polite to the CMS.
const queue = [...remote];
await Promise.all(
  Array.from({ length: 6 }, async () => {
    for (let url = queue.shift(); url; url = queue.shift()) {
      try {
        await localize(url);
      } catch (e) {
        failures.push({ url, error: String(e.message ?? e) });
      }
    }
  }),
);

for (const c of items) {
  if (typeof c.image === "string" && /^https?:/.test(c.image)) c.image = urlToLocal.get(c.image); // undefined if failed
  if (c.image === undefined) delete c.image;
}
writeFileSync(dataFile, JSON.stringify(items, null, 2) + "\n");

if (existsSync(mapDir)) writeFileSync(path.join(mapDir, "image-map.json"), JSON.stringify(Object.fromEntries(urlToLocal), null, 2) + "\n");

console.log(`localized ${urlToLocal.size}/${remote.length} images -> public/case-studies/`);
if (failures.length) {
  console.error(`${failures.length} failed (image cleared, never left remote):`);
  for (const f of failures) console.error(`  ${path.basename(new URL(f.url).pathname).replace(/[A-Za-z]+/, "…")}  ${f.error}`);
  process.exit(1);
}
