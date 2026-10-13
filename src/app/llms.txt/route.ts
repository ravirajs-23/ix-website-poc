import { getCaseStudies, getJobs } from "@/lib/data";
import { getAllPages } from "@/lib/pages";
import { absoluteUrl, site } from "@/lib/site";

// llms.txt: a concise, markdown map of the site for AI assistants (https://llmstxt.org).
export async function GET() {
  const [pages, cases, jobs] = await Promise.all([getAllPages(), getCaseStudies(), getJobs()]);

  const lines = [
    `# ${site.name}`,
    "",
    `> ${site.tagline}. ${site.description}`,
    "",
    "## Pages",
    ...pages
      .filter((p) => !p.seo.noindex)
      .map((p) => `- [${p.seo.title}](${absoluteUrl(p.path)}): ${p.seo.summary ?? p.seo.description}`),
    "",
    "## Case studies",
    ...cases.map((c) => `- [${c.title}](${absoluteUrl(`/work/${c.slug}`)}): ${c.summary}`),
    "",
    "## Open roles",
    ...jobs.map((j) => `- [${j.title}](${absoluteUrl(`/careers/${j.slug}`)}): ${j.location}, ${j.experience}`),
    "",
    "## Contact",
    `- Email: ${site.email}`,
    `- Web: ${absoluteUrl("/contact")}`,
    "",
  ];

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
