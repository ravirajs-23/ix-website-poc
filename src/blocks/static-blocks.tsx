import Image from "next/image";
import Link from "next/link";
import { Button, Container, JsonLd, Section, SectionHeading } from "@/components/ui";
import { Icon } from "@/components/icons";
import type {
  BadgesBlock, CardGridBlock, CollageBlock, CtaBlock, FaqBlock, FeatureListBlock, HeroBlock,
  IconGridBlock, LocationsBlock, ProcessBlock, RichTextBlock, StatsBlock, Tone,
} from "./types";

const cols = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-2 lg:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" } as const;
const hid = (id: string | undefined, fallback: string) => `h-${id ?? fallback}`;
const headTone = (bg: Tone) => (bg === "dark" ? "dark" : "light");

function AccentTitle({ title, accent }: { title: string; accent?: string }) {
  if (!accent || !title.includes(accent)) return <>{title}</>;
  const [before, ...rest] = title.split(accent);
  return (
    <>
      {before}
      <span className="text-sky-300">{accent}</span>
      {rest.join(accent)}
    </>
  );
}

export function Hero({ block, crumbs }: { block: HeroBlock; crumbs?: { name: string; href: string }[] }) {
  const { variant } = block;
  // Pinned heroes stay put on md+ while later sections (opaque, z-10) scroll over them.
  const pinned = block.pinned ? "md:sticky md:top-16 md:flex md:min-h-[calc(100svh-4rem)] md:items-center" : "";

  if (variant === "light") {
    return (
      <section className={`bg-surface py-14 sm:py-24 ${pinned}`}>
        <Container className="w-full">
          {crumbs && crumbs.length > 1 && (
            <nav aria-label="Breadcrumb" className="mb-8 text-sm text-muted">
              <ol className="flex flex-wrap items-center gap-2">
                {crumbs.map((c, i) => (
                  <li key={c.href} className="flex items-center gap-2">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {i < crumbs.length - 1 ? (
                      <Link href={c.href} className="hover:text-link">{c.name}</Link>
                    ) : (
                      <span aria-current="page" className="font-medium text-ink">{c.name}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          {block.eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-link">{block.eyebrow}</p>}
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] sm:text-6xl">{block.title}</h1>
          {block.subtitle && <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{block.subtitle}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            {block.ctas?.map((c) => <Button key={c.href + c.label} cta={c} />)}
          </div>
        </Container>
      </section>
    );
  }

  if (variant === "split") {
    return (
      <section className={`hero-grid bg-navy text-white ${pinned}`}>
        <Container className="grid w-full items-end gap-10 py-20 sm:py-28 lg:grid-cols-2">
          <h1 className="text-5xl font-semibold leading-[1.02] sm:text-7xl">
            <AccentTitle title={block.title} accent={block.accentWord} />
          </h1>
          <div>
            {block.subtitle && <p className="max-w-lg text-lg leading-relaxed text-slate-300 lg:ml-auto">{block.subtitle}</p>}
            <div className="mt-8 flex flex-wrap gap-3 lg:justify-end">
              {block.ctas?.map((c) => <Button key={c.href + c.label} cta={c} onDark />)}
            </div>
          </div>
        </Container>
      </section>
    );
  }

  return (
    <section className={`hero-grid relative overflow-hidden bg-navy text-white ${pinned}`}>
      {block.watermark && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-center font-display text-[22vw] font-bold uppercase leading-none text-transparent [-webkit-text-stroke:1px_rgb(255_255_255/0.09)]"
        >
          {block.watermark}
        </span>
      )}
      <Container className={`relative w-full text-center ${block.size === "xl" ? "py-28 sm:py-44" : "py-20 sm:py-32"}`}>
        {block.eyebrow && (
          <p className="mx-auto mb-6 inline-block rounded-full border border-white/20 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
            {block.eyebrow}
          </p>
        )}
        <h1
          className={`mx-auto max-w-6xl ${block.size === "xl" ? "text-[clamp(3rem,9vw,7rem)] font-bold leading-[0.92] tracking-tight" : "text-5xl font-semibold leading-[1.02] sm:text-7xl"}`}
        >
          <AccentTitle title={block.title} accent={block.accentWord} />
        </h1>
        {block.subtitle && (
          <p className={`mx-auto mt-6 max-w-2xl leading-relaxed text-slate-300 ${block.size === "xl" ? "text-xl sm:text-2xl" : "text-lg"}`}>{block.subtitle}</p>
        )}
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          {block.ctas?.map((c) => <Button key={c.href + c.label} cta={c} onDark className={block.size === "xl" ? "px-8 py-4 text-base" : ""} />)}
          {block.badge && (
            <p className="rounded-full border border-white/20 px-5 py-3 text-sm">
              <strong className="text-white">{block.badge.value}</strong>{" "}
              <span className="text-slate-300">{block.badge.label}</span>
            </p>
          )}
        </div>
      </Container>
    </section>
  );
}

export function Stats({ block }: { block: StatsBlock }) {
  const bg: Tone = block.bg ?? ((block.tone ?? "dark") === "dark" ? "dark" : "surface");
  const dark = bg === "dark";
  const split = block.layout === "split";
  const id = hid(block.id, "stats");
  return (
    <Section tone={bg} labelledBy={block.heading ? id : undefined}>
      {split ? (
        <div className="reveal mb-10 grid items-end gap-6 sm:mb-14 lg:grid-cols-2">
          <SectionHeading eyebrow={block.eyebrow} heading={block.heading} tone={headTone(bg)} id={id} />
          {block.intro && <p className={`pb-1 text-lg leading-relaxed ${dark ? "text-slate-300" : "text-muted"}`}>{block.intro}</p>}
        </div>
      ) : (
        <SectionHeading {...block} tone={headTone(bg)} id={id} />
      )}
      <dl className={`grid gap-px overflow-hidden rounded-card sm:grid-cols-2 lg:grid-cols-3 ${dark ? "bg-white/10" : "bg-line"}`}>
        {block.items.map((s) => (
          <div key={s.label} className={`reveal flex flex-col p-8 ${dark ? "bg-navy-2" : "bg-white"}`}>
            {/* DOM order is dt then dd (valid <dl>); CSS order shows the number first. */}
            <dt className="order-2 mt-2 text-base font-medium">{s.label}</dt>
            <dd className="order-1 font-display text-5xl font-semibold text-brand sm:text-6xl">{s.value}</dd>
            {s.note && <dd className={`order-3 mt-1 text-sm ${dark ? "text-slate-400" : "text-muted"}`}>{s.note}</dd>}
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function CardGrid({ block }: { block: CardGridBlock }) {
  const bg = block.bg ?? "surface";
  const id = hid(block.id, "cards");

  if (block.variant === "portrait") {
    return (
      <Section tone={bg} labelledBy={block.heading ? id : undefined}>
        <SectionHeading {...block} tone={headTone(bg)} id={id} />
        <ul className="grid grid-cols-2 gap-5 sm:gap-7 lg:grid-cols-4">
          {block.items.map((p) => (
            <li key={p.title} className="reveal">
              <div className="relative aspect-[4/5] overflow-hidden rounded-card bg-gradient-to-br from-brand to-navy">
                {p.image && (
                  <Image src={p.image.src} alt={p.image.alt} fill sizes="(min-width:1024px) 25vw, 50vw" className="object-cover object-top" />
                )}
              </div>
              <h3 className="mt-4 text-xl font-semibold">{p.title}</h3>
              {p.tag && <p className="text-sm font-semibold text-link">{p.tag}</p>}
              <p className="mt-2 text-sm leading-relaxed text-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </Section>
    );
  }

  return (
    <Section tone={bg} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone={headTone(bg)} id={id} />
      <ul className={`grid gap-6 ${cols[block.columns ?? 3]}`}>
        {block.items.map((c) => (
          <li key={c.title} className="reveal relative flex flex-col rounded-card border border-line bg-white p-7 text-ink shadow-sm transition-shadow hover:shadow-lg">
            {c.tag && <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand">{c.tag}</p>}
            <h3 className="text-2xl font-semibold">{c.title}</h3>
            <p className="mt-3 flex-1 leading-relaxed text-muted">{c.body}</p>
            {c.href && (
              <Link href={c.href} className="mt-5 text-sm font-semibold text-link after:absolute after:inset-0 hover:underline">
                {c.linkLabel ?? "Learn more"} <span aria-hidden="true">→</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function IconGrid({ block }: { block: IconGridBlock }) {
  const bg: Tone = block.bg ?? (block.tone === "dark" ? "dark" : "light");
  const dark = bg === "dark";
  const id = hid(block.id, "icons");
  return (
    <Section tone={bg} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone={headTone(bg)} id={id} />
      <ul className={`grid gap-5 ${cols[block.columns ?? 3]}`}>
        {block.items.map((i) => (
          <li
            key={i.title}
            className={`reveal rounded-card border p-6 ${dark ? "border-white/10 bg-navy-2" : bg === "surface" ? "border-line bg-white" : "border-line bg-surface"}`}
          >
            <span className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Icon name={i.icon} />
            </span>
            <h3 className="text-xl font-semibold">{i.title}</h3>
            {i.body && <p className={`mt-2 text-sm leading-relaxed ${dark ? "text-slate-300" : "text-muted"}`}>{i.body}</p>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function FeatureList({ block }: { block: FeatureListBlock }) {
  const bg = block.bg ?? "dark";
  const dark = bg === "dark";
  const id = hid(block.id, "features");

  if (block.variant === "zigzag") {
    return (
      <Section tone={bg} labelledBy={block.heading ? id : undefined}>
        <SectionHeading {...block} tone={headTone(bg)} id={id} />
        <ol className="space-y-14 sm:space-y-20">
          {block.items.map((f, n) => {
            const flip = n % 2 === 1;
            return (
              <li key={f.title} className="reveal grid items-center gap-8 md:grid-cols-2 md:gap-14">
                <div className={flip ? "md:order-2" : ""}>
                  <span className="font-display text-5xl font-semibold text-brand">{String(n + 1).padStart(2, "0")}</span>
                  <h3 className="mt-2 text-3xl font-semibold sm:text-4xl">{f.title}</h3>
                  {f.body && <p className={`mt-3 text-lg leading-relaxed ${dark ? "text-slate-300" : "text-muted"}`}>{f.body}</p>}
                </div>
                <div
                  className={`relative aspect-[4/3] overflow-hidden rounded-card bg-gradient-to-br from-brand to-navy-2 ${flip ? "md:order-1" : ""}`}
                  style={{
                    clipPath: flip ? "polygon(8% 0,100% 0,100% 100%,0 100%)" : "polygon(0 0,100% 0,92% 100%,0 100%)",
                  }}
                >
                  {f.image && <Image src={f.image.src} alt={f.image.alt} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover" />}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>
    );
  }

  return (
    <Section tone={bg} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone={headTone(bg)} id={id} />
      <ol className={`grid gap-px overflow-hidden rounded-card md:grid-cols-2 ${dark ? "bg-white/10" : "bg-line"}`}>
        {block.items.map((f, n) => (
          <li key={f.title} className={`reveal flex gap-5 p-8 ${dark ? "bg-navy-2" : "bg-white"}`}>
            <span className="font-display text-4xl font-semibold text-brand">{String(n + 1).padStart(2, "0")}</span>
            <div>
              <h3 className="text-2xl font-semibold">{f.title}</h3>
              {f.body && <p className={`mt-2 ${dark ? "text-slate-300" : "text-muted"}`}>{f.body}</p>}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function Faq({ block }: { block: FaqBlock }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: block.items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
  const id = hid(block.id, "faq");
  const group = `faq-${block.id ?? "list"}`;
  return (
    <Section tone={block.bg ?? "light"} labelledBy={id}>
      <JsonLd data={ld} />
      <SectionHeading {...block} tone="light" id={id} heading={block.heading ?? "Frequently asked questions"} />
      <div className="max-w-3xl divide-y divide-line rounded-card border border-line bg-white">
        {block.items.map((i) => (
          // Shared `name` makes native <details> exclusive (one open at a time) with no JavaScript.
          <details key={i.q} name={block.singleOpen ? group : undefined} className="group p-6">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold">
              {i.q}
              <span aria-hidden="true" className="text-brand transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{i.a}</p>
          </details>
        ))}
      </div>
    </Section>
  );
}

export function Badges({ block }: { block: BadgesBlock }) {
  const bg = block.bg ?? "surface";
  const id = hid(block.id, "badges");
  const chip = (b: BadgesBlock["items"][number]) => (
    <>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
        <Icon name="award" className="h-5 w-5" />
      </span>
      <span>
        <span className="block font-semibold">{b.name}</span>
        {b.label && <span className="text-sm text-muted">{b.label}</span>}
      </span>
    </>
  );

  if (block.variant === "marquee") {
    return (
      <Section tone={bg} labelledBy={block.heading ? id : undefined} className="py-12! sm:py-16!">
        <SectionHeading {...block} tone={headTone(bg)} id={id} />
        <div className="marquee-mask overflow-hidden motion-reduce:overflow-x-auto">
          <ul className="marquee flex w-max gap-4">
            {block.items.map((b) => (
              <li key={b.name} className="flex items-center gap-4 rounded-card border border-line bg-white p-5 text-ink">
                {chip(b)}
              </li>
            ))}
            {/* Duplicate set makes the loop seamless; hidden from assistive tech and for reduced motion. */}
            {block.items.map((b) => (
              <li key={`dup-${b.name}`} aria-hidden="true" className="marquee-dup flex items-center gap-4 rounded-card border border-line bg-white p-5 text-ink">
                {chip(b)}
              </li>
            ))}
          </ul>
        </div>
      </Section>
    );
  }

  return (
    <Section tone={bg} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone={headTone(bg)} id={id} />
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {block.items.map((b) => (
          <li key={b.name} className="reveal flex items-center gap-4 rounded-card border border-line bg-white p-5 text-ink">
            {chip(b)}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Process({ block }: { block: ProcessBlock }) {
  const id = hid(block.id, "process");
  return (
    <Section tone={block.bg ?? "light"} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone={headTone(block.bg ?? "light")} id={id} />
      <ol className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {block.steps.map((s, n) => (
          <li key={s.title} className="reveal relative rounded-card border border-line bg-white p-6 text-ink">
            <span className="font-display text-3xl font-semibold text-brand">{String(n + 1).padStart(2, "0")}</span>
            <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

export function RichText({ block }: { block: RichTextBlock }) {
  const id = hid(block.id, "rich");
  const centered = block.align === "center";
  const text = (
    <div className={centered ? "mx-auto max-w-3xl text-center" : ""}>
      <SectionHeading eyebrow={block.eyebrow} heading={block.heading} id={id} align={centered ? "center" : "left"} />
      {block.lead && <p className={`-mt-6 mb-5 max-w-3xl text-xl font-semibold text-ink sm:-mt-9 ${centered ? "mx-auto" : ""}`}>{block.lead}</p>}
      <div className={`max-w-3xl space-y-5 text-lg leading-relaxed text-muted ${centered ? "mx-auto" : ""}`}>
        {block.paragraphs.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
      </div>
      {block.cta && (
        <div className={`mt-8 ${centered ? "flex justify-center" : ""}`}>
          <Button cta={block.cta} />
        </div>
      )}
      {block.media && block.callout && (
        <aside className="mt-8 rounded-card border border-line bg-surface p-6">
          <h3 className="text-xl font-semibold">{block.callout.title}</h3>
          <p className="mt-2 leading-relaxed text-muted">{block.callout.body}</p>
        </aside>
      )}
    </div>
  );

  if (block.media) {
    const left = block.media.side === "left";
    return (
      <Section tone={block.bg ?? "light"} labelledBy={block.heading ? id : undefined}>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className={left ? "lg:order-2" : ""}>{text}</div>
          <div className={`relative ${block.media.frame ? (left ? "pl-4 pb-4 sm:pl-6 sm:pb-6" : "pr-4 pb-4 sm:pr-6 sm:pb-6") : ""} ${left ? "lg:order-1" : ""}`}>
            {block.media.frame && (
              // Decorative offset block behind the photo, in the brand colour.
              <span
                aria-hidden="true"
                className={`absolute bottom-0 h-[calc(100%-1rem)] w-[calc(100%-1rem)] rounded-card bg-brand sm:h-[calc(100%-1.5rem)] sm:w-[calc(100%-1.5rem)] ${left ? "left-0" : "right-0"}`}
              />
            )}
            <div className="relative aspect-[4/3] overflow-hidden rounded-card bg-gradient-to-br from-brand to-navy">
              <Image src={block.media.image.src} alt={block.media.image.alt} fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
            </div>
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section tone={block.bg ?? "light"} labelledBy={block.heading ? id : undefined}>
      <div className={centered ? "" : "grid gap-12 lg:grid-cols-[1.4fr_1fr]"}>
        {text}
        {block.callout && !centered && (
          <aside className="h-fit rounded-card border border-line bg-surface p-7">
            <h3 className="text-xl font-semibold">{block.callout.title}</h3>
            <p className="mt-3 leading-relaxed text-muted">{block.callout.body}</p>
          </aside>
        )}
      </div>
    </Section>
  );
}

export function Cta({ block }: { block: CtaBlock }) {
  return (
    <section className="hero-grid bg-navy py-16 text-center text-white sm:py-24">
      <Container>
        {block.eyebrow && <p className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">{block.eyebrow}</p>}
        <h2 className="mx-auto max-w-3xl text-4xl font-semibold sm:text-5xl">{block.heading}</h2>
        {block.body && <p className="mx-auto mt-4 max-w-xl text-lg text-slate-300">{block.body}</p>}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button cta={block.primary} />
          {block.secondary && <Button cta={{ ...block.secondary, style: "secondary" }} onDark />}
        </div>
      </Container>
    </section>
  );
}

export function Collage({ block }: { block: CollageBlock }) {
  const id = hid(block.id, "collage");
  return (
    <Section tone={block.bg ?? "dark"} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone={headTone(block.bg ?? "dark")} id={id} />
      <ul className="grid gap-6 sm:grid-cols-2">
        {block.items.map((c, n) => (
          <li
            key={c.caption}
            className={`reveal relative flex min-h-64 items-end overflow-hidden rounded-card p-6 text-white ${n % 2 ? "sm:mt-12" : ""}`}
            style={{
              clipPath: n % 2 ? "polygon(6% 0,100% 0,100% 100%,0 100%)" : "polygon(0 0,100% 0,94% 100%,0 100%)",
              background: n % 2 ? "linear-gradient(135deg,#2f45dc,#0b1c45)" : "linear-gradient(135deg,#196cfa,#06122e)",
            }}
          >
            {c.image && (
              <>
                <Image src={c.image.src} alt={c.image.alt} fill sizes="(min-width:640px) 50vw, 100vw" className="object-cover" />
                <span aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-navy/85 to-transparent" />
              </>
            )}
            <p className="relative text-xl font-semibold">{c.caption}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function Locations({ block }: { block: LocationsBlock }) {
  const id = hid(block.id, "loc");
  return (
    <Section tone={block.bg ?? "surface"} labelledBy={block.heading ? id : undefined}>
      <SectionHeading {...block} tone="light" id={id} heading={block.heading ?? "Our offices"} />
      <ul className="grid gap-5 sm:grid-cols-3">
        {block.items.map((l) => (
          <li key={l.city} className="rounded-card border border-line bg-white p-6">
            <h3 className="text-xl font-semibold">{l.city}</h3>
            {l.detail && <p className="mt-2 text-sm text-muted">{l.detail}</p>}
          </li>
        ))}
      </ul>
    </Section>
  );
}
