import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { crumbsFor } from "@/components/PageView";
import { Button, Container, JsonLd } from "@/components/ui";
import { ReferenceTag } from "@/components/ReferenceTag";
import { getCaseStudies, getCaseStudy } from "@/lib/data";
import { breadcrumbLd, buildMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";

export async function generateStaticParams() {
  const items = await getCaseStudies();
  return items.length ? items.map((c) => ({ slug: c.slug })) : [{ slug: "_none" }];
}

export async function generateMetadata({ params }: PageProps<"/work/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const c = await getCaseStudy(slug);
  if (!c) return {};
  return buildMetadata({ title: c.title, description: c.summary, path: `/work/${c.slug}`, type: "article" });
}

export default async function CaseStudyPage({ params }: PageProps<"/work/[slug]">) {
  const { slug } = await params;
  const c = await getCaseStudy(slug);
  if (!c) notFound();

  const path = `/work/${c.slug}`;
  const crumbs = crumbsFor(path, c.title);
  const ld = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: c.title,
    description: c.summary,
    datePublished: c.publishedAt,
    dateModified: c.publishedAt,
    mainEntityOfPage: absoluteUrl(path),
    author: { "@type": "Organization", name: site.name },
    publisher: { "@type": "Organization", name: site.name, logo: { "@type": "ImageObject", url: absoluteUrl("/icon.svg") } },
  };

  return (
    <>
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <section className="hero-grid bg-navy text-white">
        <Container className="py-16 sm:py-24">
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-300">
            <ol className="flex flex-wrap gap-2">
              {crumbs.map((x, i) => (
                <li key={x.href} className="flex gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {i < crumbs.length - 1 ? <Link href={x.href} className="hover:text-white">{x.name}</Link> : <span aria-current="page">{x.name}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">{c.client}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-semibold leading-tight sm:text-6xl">{c.title}</h1>
          <p className="mt-5 max-w-2xl text-lg text-slate-300">{c.summary}</p>
          <p className="mt-6 text-sm text-slate-400">{[...c.services, ...c.industries].join(" · ")}</p>
        </Container>
      </section>
      <section className="py-14 sm:py-20">
        <Container className="max-w-4xl space-y-12">
          {c.challenge && (
            <div>
              <h2 className="text-3xl font-semibold">The challenge</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">{c.challenge}</p>
            </div>
          )}
          {c.solution && (
            <div>
              <h2 className="text-3xl font-semibold">Our solution</h2>
              <p className="mt-3 text-lg leading-relaxed text-muted">{c.solution}</p>
            </div>
          )}
          {c.solutionPoints && c.solutionPoints.length > 0 && (
            <ul className="list-disc space-y-2 pl-5 text-lg text-muted">
              {c.solutionPoints.map((p) => <li key={p}>{p}</li>)}
            </ul>
          )}
          {c.techStack && c.techStack.length > 0 && (
            <div>
              <h2 className="text-3xl font-semibold">Technology stack</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {c.techStack.map((t) => <li key={t} className="rounded-full border border-line bg-surface px-4 py-1.5 text-sm">{t}</li>)}
              </ul>
            </div>
          )}
          {c.results && c.results.length > 0 && (
            <div>
              <h2 className="text-3xl font-semibold">Results</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-lg text-muted">
                {c.results.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          )}
          <Button cta={{ label: "Start a conversation", href: "/contact" }} />
        </Container>
      </section>
      <ReferenceTag reference={{ name: "Own design (case study detail)" }} />
    </>
  );
}
