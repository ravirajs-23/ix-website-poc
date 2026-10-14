import { cacheLife, cacheTag } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { PageDefinition } from "@/blocks/types";

/**
 * Static pages are JSON files in src/content/pages. A page's slug is its file name
 * ("home.json" is "/"). Dropping a new JSON file in that folder creates a new route —
 * this is the contract the phase-2 page-generating agent targets.
 */
const dir = path.join(process.cwd(), "src", "content", "pages");

export async function listPageSlugs(): Promise<string[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("pages");
  const files = await fs.readdir(dir);
  return files.filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""));
}

export async function getPage(slug: string): Promise<PageDefinition | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("pages");
  try {
    return JSON.parse(await fs.readFile(path.join(dir, `${slug}.json`), "utf8")) as PageDefinition;
  } catch {
    return null;
  }
}

export async function getAllPages(): Promise<PageDefinition[]> {
  const slugs = await listPageSlugs();
  const pages = await Promise.all(slugs.map((s) => getPage(s)));
  return pages.filter((p): p is PageDefinition => !!p);
}
