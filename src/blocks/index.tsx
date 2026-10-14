import Link from "next/link";
import { Button, Container, Section, SectionHeading } from "@/components/ui";
import { getCaseStudies, getJobs, getTestimonials } from "@/lib/data";
import {
  CaseStudyGrid, ContactForm, TabsView, TestimonialsCarousel, TestimonialsGrid, TestimonialsSpotlight,
} from "./interactive";
import {
  Badges, CardGrid, Collage, Cta, Faq, FeatureList, Hero, IconGrid, Locations, Process, RichText, Stats,
} from "./static-blocks";
import type {
  Block, CaseStudiesBlock, ContactBlock, JobsBlock, TabsBlock, TestimonialsBlock, Tone,
} from "./types";

async function Testimonials({ block }: { block: TestimonialsBlock }) {
  const all = await getTestimonials();
  const items = block.limit ? all.slice(0, block.limit) : all;
  if (!items.length) return null;
  const id = `h-${block.id ?? "testimonials"}`;
  const variant = block.variant ?? "carousel";

  if (variant === "spotlight") {
    return (
      <section aria-labelledby={block.heading ? id : undefined} className="hero-grid bg-navy py-16 text-white sm:py-24">
        <Container>
          <SectionHeading {...block} tone="dark" id={id} />
          <TestimonialsSpotlight items={items} />
        </Container>
      </section>
    );
  }

  const bg: Tone = block.bg ?? "surface";
  const labelledBy = block.heading ? id : undefined;

  if (variant === "carousel" && block.split) {
    return (
      <Section tone={bg} labelledBy={labelledBy}>
        <div className="grid items-start gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading eyebrow={block.eyebrow} heading={block.heading} intro={block.intro} id={id} />
            {block.cta && <Button cta={block.cta} />}
          </div>
          <div className="min-w-0">
            <TestimonialsCarousel items={items} perView={1} controlsTop labelledBy={labelledBy} />
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section tone={bg} labelledBy={labelledBy}>
      <SectionHeading {...block} tone="light" id={id} />
      {variant === "grid" ? (
        <TestimonialsGrid items={items} initial={block.initial} labelledBy={labelledBy} />
      ) : (
        <TestimonialsCarousel items={items} labelledBy={labelledBy} />
      )}
    </Section>
  );
}

async function CaseStudies({ block }: { block: CaseStudiesBlock }) {
  const all = await getCaseStudies();
  const items = block.limit ? all.slice(0, block.limit) : all;
  const id = `h-${block.id ?? "case-studies"}`;
  return (
    <Section tone={block.bg ?? "light"} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone="light" id={id} />
      <CaseStudyGrid items={items} filterable={!!block.filterable} align={block.align} size={block.size} hint={block.hint} />
      {block.viewAll && (
        <div className="mt-10 text-center">
          <Button cta={{ ...block.viewAll, style: "secondary" }} />
        </div>
      )}
    </Section>
  );
}

async function Jobs({ block }: { block: JobsBlock }) {
  const all = await getJobs();
  const items = block.featuredOnly ? all.filter((j) => j.featured) : all;
  const id = `h-${block.id ?? "jobs"}`;
  return (
    <Section tone={block.bg ?? "light"} id="openings" labelledBy={id}>
      <SectionHeading {...block} tone="light" id={id} heading={block.heading ?? "Open positions"} />
      {items.length === 0 ? (
        <p className="text-muted">No open roles right now — send us your CV at the contact page and we will keep it on file.</p>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {items.map((j) => (
            <li key={j.slug}>
              <article className="relative flex h-full flex-col rounded-card border border-line bg-white p-7 text-ink transition-shadow hover:shadow-xl">
                {j.example ? (
                  <p className="mb-3"><span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-950">Example role</span></p>
                ) : (
                  j.featured && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-link">Featured opening</p>
                )}
                <h3 className="text-2xl font-semibold">
                  <Link href={`/careers/${j.slug}`} className="after:absolute after:inset-0 hover:text-link">
                    {j.title}
                  </Link>
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {j.department} · {j.location} · {j.experience}
                </p>
                <p className="mt-4 flex-1 leading-relaxed text-muted">{j.summary}</p>
                <div className="mt-5 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-link">
                    View details <span aria-hidden="true">+</span>
                  </span>
                  {block.applyLabel && (
                    <Link
                      href={`/contact?role=${encodeURIComponent(j.title)}`}
                      className="relative z-10 rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand-deep"
                    >
                      {block.applyLabel}
                    </Link>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      {block.footer && (
        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-card border border-line bg-surface p-6 sm:flex-row">
          <p className="text-lg font-semibold">{block.footer.text}</p>
          <Button cta={block.footer.cta} />
        </div>
      )}
      {block.viewAll && (
        <div className="mt-10 text-center">
          <Button cta={{ ...block.viewAll, style: "secondary" }} />
        </div>
      )}
    </Section>
  );
}

function Tabs({ block }: { block: TabsBlock }) {
  const id = `h-${block.id ?? "tabs"}`;
  return (
    <Section tone={block.bg ?? "light"} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone="light" id={id} />
      <TabsView tabs={block.tabs} layout={block.layout} />
    </Section>
  );
}

function Contact({ block }: { block: ContactBlock }) {
  const id = `h-${block.id ?? "contact"}`;
  return (
    <Section labelledBy={id}>
      <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeading {...block} id={id} />
          <dl className="space-y-5">
            {block.details.map((d) => (
              <div key={d.label}>
                <dt className="text-sm font-semibold uppercase tracking-wider text-link">{d.label}</dt>
                <dd className="mt-1 text-lg">
                  {d.href ? (
                    <a href={d.href} className="hover:text-link">
                      {d.value}
                    </a>
                  ) : (
                    d.value
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <ContactForm />
      </div>
    </Section>
  );
}

export type RenderContext = { crumbs: { name: string; href: string }[] };

function renderBlock(block: Block, key: string, ctx: RenderContext) {
  switch (block.type) {
    case "hero": return <Hero key={key} block={block} crumbs={ctx.crumbs} />;
    case "stats": return <Stats key={key} block={block} />;
    case "cardGrid": return <CardGrid key={key} block={block} />;
    case "iconGrid": return <IconGrid key={key} block={block} />;
    case "featureList": return <FeatureList key={key} block={block} />;
    case "testimonials": return <Testimonials key={key} block={block} />;
    case "caseStudies": return <CaseStudies key={key} block={block} />;
    case "tabs": return <Tabs key={key} block={block} />;
    case "jobs": return <Jobs key={key} block={block} />;
    case "faq": return <Faq key={key} block={block} />;
    case "badges": return <Badges key={key} block={block} />;
    case "process": return <Process key={key} block={block} />;
    case "richText": return <RichText key={key} block={block} />;
    case "cta": return <Cta key={key} block={block} />;
    case "collage": return <Collage key={key} block={block} />;
    case "locations": return <Locations key={key} block={block} />;
    case "contact": return <Contact key={key} block={block} />;
  }
}

export function BlockRenderer({ blocks, ctx }: { blocks: Block[]; ctx: RenderContext }) {
  const nodes = blocks.map((block, i) => {
    const key = `${block.type}-${i}`;
    const el = renderBlock(block, key, ctx);
    // Anchored blocks become jump targets; scroll-mt clears the sticky header.
    return block.anchor ? (
      <div key={key} id={block.anchor} className="scroll-mt-16">
        {el}
      </div>
    ) : (
      el
    );
  });

  // A pinned hero stays fixed (md+) while everything after it scrolls over it as an opaque layer.
  const first = blocks[0];
  if (first?.type === "hero" && first.pinned) {
    return (
      <>
        {nodes[0]}
        <div className="relative z-10">{nodes.slice(1)}</div>
      </>
    );
  }
  return <>{nodes}</>;
}
