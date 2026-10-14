/**
 * Image localisation for the page factory.
 *
 * CMS uploads (ixwebapi.incubxperts.com) have file names that embed internal project / client names.
 * Any such image used by a generated page is downloaded, re-encoded as a compressed WebP (metadata stripped)
 * and saved under public/factory-media/ with a neutral hash name, and the page JSON is rewritten to the
 * local path. Images from allowed marketing hosts (next.config.ts images.remotePatterns, other than the
 * CMS host) are left as they are.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CMS_HOSTS = ["ixwebapi.incubxperts.com"];

export function allowedImageHosts(): string[] {
  const cfg = readFileSync(path.join(root, "next.config.ts"), "utf8");
  return [...cfg.matchAll(/hostname:\s*"([^"]+)"/g)].map((m) => m[1]);
}

/** True when the image must be copied locally under a neutral name. */
export function needsLocalizing(src: string): boolean {
  if (!/^https?:/i.test(src)) return false;
  const host = new URL(src).hostname;
  return CMS_HOSTS.includes(host) || !allowedImageHosts().includes(host);
}

async function fetchBuffer(url: string): Promise<Buffer> {
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
  throw new Error("unreachable");
}

/** Download + re-encode one image; returns the local public path (e.g. /factory-media/fm-ab12cd34ef.webp). */
export async function localizeImage(url: string): Promise<string> {
  const { default: sharp } = await import("sharp");
  const outDir = path.join(root, "public", "factory-media");
  mkdirSync(outDir, { recursive: true });
  const name = `fm-${createHash("sha1").update(url).digest("hex").slice(0, 10)}.webp`;
  const dest = path.join(outDir, name);
  if (!existsSync(dest)) {
    const input = await fetchBuffer(url);
    const isSvg = /\.svg(\?|$)/i.test(url) || input.subarray(0, 300).toString("utf8").includes("<svg");
    await sharp(input, isSvg ? { density: 144 } : {})
      .resize({ width: 1200, withoutEnlargement: !isSvg })
      .webp({ quality: 76 })
      .toFile(dest);
  }
  return `/factory-media/${name}`;
}

/** Walk any JSON value; localise every `src` that needs it. Returns the number rewritten. */
export async function localizeImagesIn(value: unknown, log: (m: string) => void = () => {}): Promise<number> {
  let count = 0;
  const jobs: Promise<void>[] = [];
  const visit = (node: unknown) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(obj)) {
        if (k === "src" && typeof v === "string" && needsLocalizing(v)) {
          jobs.push(
            localizeImage(v).then((local) => {
              obj[k] = local;
              count++;
              log(`localized image -> ${local}`);
            }),
          );
        } else visit(v);
      }
    }
  };
  visit(value);
  await Promise.all(jobs);
  return count;
}
