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

async function fromStrapi<T>(collection: string): Promise<T[] | null> {
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
    return json.data.map((i) => flatten<T>(i));
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

async function load<T>(collection: string, fallbackFile: string): Promise<T[]> {
  return (await fromStrapi<T>(collection)) ?? (await fromFile<T>(fallbackFile));
}

export async function getCaseStudies(): Promise<CaseStudy[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("strapi", "case-studies");
  const items = (await load<CaseStudy>("case-studies", "case-studies")).map((c) => ({
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
  const items = await load<Job>("jobs", "jobs");
  return items.sort((a, b) => b.postedAt.localeCompare(a.postedAt));
}

export async function getJob(slug: string): Promise<Job | undefined> {
  return (await getJobs()).find((j) => j.slug === slug);
}

export async function getTestimonials(): Promise<Testimonial[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("strapi", "testimonials");
  return load<Testimonial>("testimonials", "testimonials");
}
