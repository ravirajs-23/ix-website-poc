import type { MetadataRoute } from "next";
import { getCaseStudies, getJobs } from "@/lib/data";
import { getAllPages } from "@/lib/pages";
import { absoluteUrl } from "@/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [pages, cases, jobs] = await Promise.all([getAllPages(), getCaseStudies(), getJobs()]);
  return [
    ...pages
      .filter((p) => !p.seo.noindex)
      .map((p) => ({
        url: absoluteUrl(p.path),
        changeFrequency: "monthly" as const,
        priority: p.path === "/" ? 1 : 0.8,
      })),
    ...cases.map((c) => ({
      url: absoluteUrl(`/work/${c.slug}`),
      lastModified: new Date(c.publishedAt),
      changeFrequency: "yearly" as const,
      priority: 0.6,
    })),
    ...jobs.filter((j) => !j.example).map((j) => ({
      url: absoluteUrl(`/careers/${j.slug}`),
      lastModified: new Date(j.postedAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
