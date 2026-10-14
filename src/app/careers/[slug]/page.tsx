import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { crumbsFor } from "@/components/PageView";
import { Button, Container, JsonLd } from "@/components/ui";
import { ReferenceTag } from "@/components/ReferenceTag";
import { getJob, getJobs } from "@/lib/data";
import { breadcrumbLd, buildMetadata } from "@/lib/seo";
import { absoluteUrl, site } from "@/lib/site";
import Link from "next/link";

export async function generateStaticParams() {
  const jobs = await getJobs();
  // Cache Components requires at least one param at build time.
  return jobs.length ? jobs.map((j) => ({ slug: j.slug })) : [{ slug: "_none" }];
}

export async function generateMetadata({ params }: PageProps<"/careers/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) return {};
  return buildMetadata({
    title: `${job.title} — ${job.location}`,
    description: job.summary,
    path: `/careers/${job.slug}`,
  });
}

export default async function JobPage({ params }: PageProps<"/careers/[slug]">) {
  const { slug } = await params;
  const job = await getJob(slug);
  if (!job) notFound();

  const path = `/careers/${job.slug}`;
  const crumbs = crumbsFor(path, job.title);
  const descriptionHtml =
    `<p>${job.summary}</p><h3>Responsibilities</h3><ul>${job.responsibilities.map((r) => `<li>${r}</li>`).join("")}</ul>` +
    `<h3>Requirements</h3><ul>${job.requirements.map((r) => `<li>${r}</li>`).join("")}</ul>`;

  const ld = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: descriptionHtml,
    datePosted: job.postedAt,
    ...(job.validThrough ? { validThrough: job.validThrough } : {}),
    employmentType: job.employmentType,
    directApply: false,
    identifier: { "@type": "PropertyValue", name: site.name, value: job.slug },
    hiringOrganization: { "@type": "Organization", name: site.name, sameAs: absoluteUrl("/"), logo: absoluteUrl("/icon.svg") },
    jobLocation: {
      "@type": "Place",
      address: {
        "@type": "PostalAddress",
        streetAddress: site.address.street,
        postalCode: site.address.postalCode,
        addressLocality: site.address.locality,
        addressRegion: site.address.region,
        addressCountry: site.address.country,
      },
    },
  };

  return (
    <>
      <JsonLd data={ld} />
      <JsonLd data={breadcrumbLd(crumbs)} />
      <section className="bg-surface py-14 sm:py-20">
        <Container>
          <nav aria-label="Breadcrumb" className="mb-6 text-sm text-muted">
            <ol className="flex flex-wrap gap-2">
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {i < crumbs.length - 1 ? <Link href={c.href} className="hover:text-link">{c.name}</Link> : <span aria-current="page">{c.name}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-link">{job.department}</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold sm:text-6xl">{job.title}</h1>
          <p className="mt-4 text-lg text-muted">
            {job.location} · {job.experience} · {job.employmentType.replace("_", " ").toLowerCase()}
          </p>
        </Container>
      </section>
      <section className="py-14 sm:py-20">
        <Container className="grid gap-12 lg:grid-cols-[1.5fr_1fr]">
          <div className="space-y-10">
            <p className="text-lg leading-relaxed text-muted">{job.summary}</p>
            <div>
              <h2 className="text-3xl font-semibold">Responsibilities</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
                {job.responsibilities.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
            <div>
              <h2 className="text-3xl font-semibold">Requirements</h2>
              <ul className="mt-4 list-disc space-y-2 pl-5 text-muted">
                {job.requirements.map((r) => <li key={r}>{r}</li>)}
              </ul>
            </div>
          </div>
          <aside className="h-fit rounded-card border border-line bg-surface p-7">
            <h2 className="text-2xl font-semibold">Interested?</h2>
            <p className="mt-3 text-muted">Tell us about yourself and attach your CV or profile link.</p>
            <div className="mt-6">
              <Button cta={{ label: "Apply now", href: `/contact?role=${encodeURIComponent(job.title)}` }} />
            </div>
          </aside>
        </Container>
      </section>
      <ReferenceTag reference={{ name: "Own design (job detail)" }} />
    </>
  );
}
