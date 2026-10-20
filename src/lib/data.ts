import { cacheLife, cacheTag } from "next/cache";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { CaseStudy, Job, Testimonial } from "./types";

/**
 * Content source for collections that editors manage (jobs, case studies, testimonials).
 *
 * If STRAPI_URL is set and reachable, data comes from Strapi (v5 flat or v4 nested responses).
 * Otherwise — or if Strapi errors — it falls back to local JSON in src/content/data, so the
 * site always builds. Cached for an hour; call revalidateTag("strapi") from a webhook to refresh.
 */

const STRAPI_URL = process.env.STRAPI_URL?.replace(/\/$/, "");
const STRAPI_TOKEN = process.env.STRAPI_TOKEN;

type StrapiItem = Record<string, unknown> & { attributes?: Record<string, unknown> };

function flatten<T>(item: StrapiItem): T {
  // v4 wraps fields in `attributes`; v5 returns them flat.
  const base = item.attributes ? { ...item.attributes } : { ...item };
  return base as T;
}

const filled = (v: unknown) => typeof v === "string" && v.length > 0;
// A Strapi collection is only used if EVERY item has the fields this site needs. A Strapi with a different
// content model (or a wrong collection) must fall back to the local JSON, never break the build.
const isCaseStudy = (c: Partial<CaseStudy>) => filled(c.slug) && filled(c.title) && filled(c.summary) && (filled(c.publishedOn) || filled(c.publishedAt));
const isJob = (j: Partial<Job>) => filled(j.slug) && filled(j.title) && filled(j.summary) && filled(j.postedAt);
const isTestimonial = (t: Partial<Testimonial>) => filled(t.name) && filled(t.quote);

async function fromStrapi<T>(collection: string, valid: (item: T) => boolean): Promise<T[] | null> {
  if (!STRAPI_URL) return null;
  try {
    const res = await fetch(
      `${STRAPI_URL}/api/${collection}?pagination[pageSize]=100&populate=*`,
      {
        headers: STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {},
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { data?: StrapiItem[] };
    if (!Array.isArray(json.data)) return null;
    const items = json.data.map((i) => flatten<T>(i));
    return items.every(valid) ? items : null;
  } catch {
    return null;
  }
}

async function fromFile<T>(name: string): Promise<T[]> {
  "use cache";
  cacheLife("hours");
  const file = path.join(process.cwd(), "src", "content", "data", `${name}.json`);
  return JSON.parse(await fs.readFile(file, "utf8")) as T[];
}

async function load<T>(collection: string, fallbackFile: string, valid: (item: T) => boolean): Promise<T[]> {
  return (await fromStrapi<T>(collection, valid)) ?? (await fromFile<T>(fallbackFile));
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("strapi", "case-studies");
  const items = (await load<CaseStudy>("case-studies", "case-studies", isCaseStudy)).map((c) => ({
    ...c,
    // Strapi stores the editor-set date as publishedOn (publishedAt is Strapi's own publish timestamp).
    publishedAt: c.publishedOn ?? c.publishedAt,
  }));
  return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function getCaseStudy(slug: string): Promise<CaseStudy | undefined> {
  return (await getCaseStudies()).find((c) => c.slug === slug);
}

export async function getJobs(): Promise<Job[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("strapi", "jobs");
  const items = await load<Job>("jobs", "jobs", isJob);
  return items.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

export async function getJob(slug: string): Promise<Job | undefined> {
  return (await getJobs()).find((j) => j.slug === slug);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("strapi", "testimonials");
  return load<Testimonial>("testimonials", "testimonials", isTestimonial);
}
