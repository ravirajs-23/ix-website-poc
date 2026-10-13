"use client";

import Image from "next/image";
import Link from "next/link";
import { Fragment, useId, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import type { CaseStudy, Testimonial } from "@/lib/types";

/* ---------------- Testimonials ---------------- */

const tKey = (t: Testimonial) => t.name + t.quote.slice(0, 20);

function QuoteCard({ t }: { t: Testimonial }) {
  return (
    <figure className="flex h-full flex-col justify-between rounded-card border border-line bg-white p-8 text-ink shadow-sm">
      <blockquote className="text-lg leading-relaxed">“{t.quote}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 font-display text-lg font-semibold text-link"
        >
          {t.name.trim()[0]}
        </span>
        <span>
          <span className="block font-semibold">{t.name}</span>
          <span className="text-sm text-muted">
            {t.title}
            {t.company ? `, ${t.company}` : ""}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Review wall: grid of cards, optionally truncated with a "Show all" button. */
export function TestimonialsGrid({ items, initial, labelledBy }: { items: Testimonial[]; initial?: number; labelledBy?: string }) {
  const [all, setAll] = useState(!initial || initial >= items.length);
  const shown = all ? items : items.slice(0, initial);
  return (
    <div>
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" aria-labelledby={labelledBy}>
        {shown.map((t) => (
          <li key={tKey(t)}>
            <QuoteCard t={t} />
          </li>
        ))}
      </ul>
      {!all && (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="rounded-full border border-ink/20 bg-white px-7 py-3 text-sm font-semibold text-ink hover:bg-surface"
          >
            Show all {items.length} reviews
          </button>
        </div>
      )}
    </div>
  );
}

/** Scroll-snap carousel. `perView` 2 = two-up; 1 = single slide (use with `controlsTop` in split layouts). */
export function TestimonialsCarousel({
  items,
  perView = 2,
  controlsTop = false,
  labelledBy,
}: {
  items: Testimonial[];
  perView?: 1 | 2;
  controlsTop?: boolean;
  labelledBy?: string;
}) {
  const track = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);

  const go = (to: number) => {
    const el = track.current;
    if (!el) return;
    const next = (to + items.length) % items.length;
    const slide = el.children[next] as HTMLElement;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: "smooth" });
    setIndex(next);
  };

  const controls = (
    <div className={`flex items-center gap-3 ${controlsTop ? "mb-5 justify-end" : "mt-6 justify-between"}`}>
      <p className="text-sm text-muted" aria-live="polite">
        {index + 1} / {items.length}
      </p>
      <div className="flex gap-2">
        <button type="button" aria-label="Previous testimonial" onClick={() => go(index - 1)} className="h-11 w-11 rounded-full border border-line bg-white text-ink hover:bg-surface">
          ←
        </button>
        <button type="button" aria-label="Next testimonial" onClick={() => go(index + 1)} className="h-11 w-11 rounded-full border border-line bg-white text-ink hover:bg-surface">
          →
        </button>
      </div>
    </div>
  );

  return (
    <div role="region" aria-roledescription="carousel" aria-labelledby={labelledBy}>
      {controlsTop && controls}
      {/* All slides are in the DOM (crawlable); scroll-snap handles the carousel without JS. */}
      <ul ref={track} className="scrollbar-none flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth">
        {items.map((t, n) => (
          <li
            key={tKey(t)}
            aria-roledescription="slide"
            aria-label={`${n + 1} of ${items.length}`}
            className={`w-full shrink-0 snap-start ${perView === 2 ? "md:w-[calc(50%-0.75rem)]" : ""}`}
          >
            <QuoteCard t={t} />
          </li>
        ))}
      </ul>
      {!controlsTop && controls}
    </div>
  );
}

/** One giant quote, with a selectable list of the people who said them. No autoplay (accessibility). */
export function TestimonialsSpotlight({ items }: { items: Testimonial[] }) {
  const [i, setI] = useState(0);
  const base = useId();
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_16rem]">
      <div className="relative min-h-72">
        {items.map((t, n) => (
          <figure key={tKey(t)} id={`${base}-q-${n}`} hidden={n !== i} className="motion-safe:animate-[ix-reveal_.5s_both]">
            <blockquote className="font-display text-3xl font-semibold leading-tight sm:text-5xl">“{t.quote}”</blockquote>
            <figcaption className="mt-8 text-base">
              <span className="block text-lg font-semibold">{t.name}</span>
              <span className="text-slate-300">
                {t.title}
                {t.company ? `, ${t.company}` : ""}
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
      <ul className="scrollbar-none flex gap-2 overflow-x-auto lg:max-h-96 lg:flex-col lg:overflow-y-auto" aria-label="Choose a testimonial">
        {items.map((t, n) => (
          <li key={tKey(t)} className="shrink-0">
            <button
              type="button"
              aria-controls={`${base}-q-${n}`}
              aria-pressed={n === i}
              onClick={() => setI(n)}
              className={`w-full rounded-lg border px-4 py-3 text-left text-sm ${n === i ? "border-brand bg-brand text-white" : "border-white/20 text-slate-200 hover:border-white/50"}`}
            >
              <span className="block font-semibold">{t.name}</span>
              <span className="block max-w-48 truncate opacity-90 lg:max-w-none">{t.title}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- Case studies (filterable grid) ---------------- */

const PAGE_SIZE = 12;

export function CaseStudyGrid({ items, filterable }: { items: CaseStudy[]; filterable: boolean }) {
  const [by, setBy] = useState<"services" | "industries">("services");
  const [active, setActive] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of items) for (const t of c[by]) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [items, by]);

  const shown = active ? items.filter((c) => c[by].includes(active)) : items;
  const reset = () => {
    setActive(null);
    setVisible(PAGE_SIZE);
  };

  return (
    <div>
      {filterable && (
        <div className="mb-10">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div role="group" aria-label="Filter by" className="inline-flex rounded-full border border-line p-1">
              {(["services", "industries"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={by === k}
                  onClick={() => {
                    setBy(k);
                    reset();
                  }}
                  className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold ${by === k ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
                >
                  <Icon name={k === "services" ? "code" : "globe"} className="h-4 w-4" />
                  By {k === "services" ? "service" : "industry"}
                </button>
              ))}
            </div>
            {active && (
              <button type="button" onClick={reset} className="text-sm font-semibold text-link underline-offset-2 hover:underline">
                Clear filter ✕
              </button>
            )}
          </div>
          <ul className="flex flex-wrap gap-2">
            <li>
              <button
                type="button"
                aria-pressed={active === null}
                onClick={reset}
                className={`rounded-full border px-4 py-2 text-sm ${active === null ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
              >
                All <span className="font-normal">{items.length}</span>
              </button>
            </li>
            {tags.map(([t, n]) => (
              <li key={t}>
                <button
                  type="button"
                  aria-pressed={active === t}
                  onClick={() => {
                    setActive(t);
                    setVisible(PAGE_SIZE);
                  }}
                  className={`rounded-full border px-4 py-2 text-sm ${active === t ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
                >
                  {t} <span className="font-normal">{n}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="sr-only" aria-live="polite">
            Showing {shown.length} case studies
          </p>
        </div>
      )}
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {shown.slice(0, visible).map((c) => (
          <li key={c.slug}>
            <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-white text-ink transition-shadow hover:shadow-xl">
              <div aria-hidden="true" className="relative h-44 bg-gradient-to-br from-brand via-brand-deep to-navy">
                {c.image && (
                  <Image src={c.image} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw" className="object-cover" />
                )}
              </div>
              <div className="flex flex-1 flex-col p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">{c.client}</p>
                <h3 className="mt-2 text-2xl font-semibold leading-snug">
                  <Link href={`/work/${c.slug}`} className="after:absolute after:inset-0 hover:text-link">
                    {c.title}
                  </Link>
                </h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-muted">{c.summary}</p>
                <p className="mt-4 text-xs text-muted">{[...c.services, ...c.industries].join(" · ")}</p>
                <span className="mt-4 text-sm font-semibold text-link">
                  Read case study <span aria-hidden="true">→</span>
                </span>
              </div>
            </article>
          </li>
        ))}
      </ul>
      {shown.length > visible && (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="rounded-full border border-ink/20 px-7 py-3 text-sm font-semibold hover:bg-surface"
          >
            Show more ({shown.length - visible} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Tabs ---------------- */

type TabItem = {
  label: string;
  title: string;
  body: string;
  points?: string[];
  quote?: { text: string; name: string; role: string };
  cta?: { label: string; href: string };
};

function Panel({ t }: { t: TabItem }) {
  return (
    <div className={`grid gap-8 ${t.quote ? "lg:grid-cols-2" : ""}`}>
      <div>
        <h3 className="text-3xl font-semibold">{t.title}</h3>
        <p className="mt-3 text-lg leading-relaxed text-muted">{t.body}</p>
        {t.points && t.points.length > 0 && (
          <ul className="mt-5 grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
            {t.points.map((p) => (
              <li key={p} className="flex items-start gap-2.5">
                <Icon name="check" className="mt-1 h-4 w-4 shrink-0 text-brand" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
        {t.cta && (
          <Link href={t.cta.href} className="mt-6 inline-block text-sm font-semibold text-link hover:underline">
            {t.cta.label} <span aria-hidden="true">→</span>
          </Link>
        )}
      </div>
      {t.quote && (
        <figure className="rounded-card bg-white p-6">
          <blockquote className="text-lg">“{t.quote.text}”</blockquote>
          <figcaption className="mt-4 text-sm">
            <span className="block font-semibold">{t.quote.name}</span>
            <span className="text-muted">{t.quote.role}</span>
          </figcaption>
        </figure>
      )}
    </div>
  );
}

export function TabsView({ tabs, layout = "pills" }: { tabs: TabItem[]; layout?: "pills" | "rail" }) {
  const [active, setActive] = useState(0);
  const base = useId();

  if (layout === "rail") {
    // One DOM list (button, panel, button, panel…): stacks as an accordion on mobile;
    // on md+ the buttons form a left rail and the active panel fills the right column.
    return (
      <div
        className="grid gap-y-2 md:grid-cols-[17rem_1fr] md:gap-x-10"
        style={{ "--n": tabs.length } as React.CSSProperties}
      >
        {tabs.map((t, i) => (
          <Fragment key={t.label}>
            <button
              id={`${base}-t-${i}`}
              type="button"
              aria-expanded={active === i}
              aria-controls={`${base}-p-${i}`}
              onClick={() => setActive(i)}
              style={{ "--r": i + 1 } as React.CSSProperties}
              className={`flex items-center justify-between gap-3 rounded-lg border px-5 py-4 text-left text-base font-semibold md:self-start md:[grid-column:1] md:[grid-row:var(--r)] ${active === i ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}
            >
              {t.label}
              <span aria-hidden="true" className="md:hidden">
                {active === i ? "−" : "+"}
              </span>
              <span aria-hidden="true" className="hidden md:inline">
                →
              </span>
            </button>
            <div
              id={`${base}-p-${i}`}
              role="region"
              aria-labelledby={`${base}-t-${i}`}
              hidden={active !== i}
              style={{ "--n": tabs.length } as React.CSSProperties}
              className="rounded-card border border-line bg-surface p-6 sm:p-8 md:[grid-column:2] md:[grid-row:1/span_var(--n)]"
            >
              <Panel t={t} />
            </div>
          </Fragment>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Choose a path" className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            id={`${base}-tab-${i}`}
            role="tab"
            type="button"
            aria-selected={active === i}
            aria-controls={`${base}-panel-${i}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setActive((active + 1) % tabs.length);
              if (e.key === "ArrowLeft") setActive((active - 1 + tabs.length) % tabs.length);
            }}
            className={`rounded-full border px-5 py-2.5 text-sm font-semibold ${active === i ? "border-brand bg-brand text-white" : "border-line hover:border-brand"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* Every panel stays in the DOM so content is indexable; inactive ones are hidden visually. */}
      {tabs.map((t, i) => (
        <div
          key={t.label}
          id={`${base}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${base}-tab-${i}`}
          hidden={active !== i}
          className="rounded-card border border-line bg-surface p-8"
        >
          <Panel t={t} />
        </div>
      ))}
    </div>
  );
}

/* ---------------- Contact form ---------------- */

export function ContactForm() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Something went wrong");
      form.reset();
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setState("error");
    }
  }

  const field = "mt-1 w-full rounded-lg border border-line bg-white px-4 py-3 text-base focus:border-brand";
  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-card border border-line bg-white p-7 shadow-sm">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Name
          <input name="name" required autoComplete="name" className={field} />
        </label>
        <label className="block text-sm font-medium">
          Work email
          <input name="email" type="email" required autoComplete="email" className={field} />
        </label>
      </div>
      <label className="block text-sm font-medium">
        Company
        <input name="company" autoComplete="organization" className={field} />
      </label>
      <label className="block text-sm font-medium">
        How can we help?
        <textarea name="message" required rows={5} className={field} />
      </label>
      {/* Honeypot: real users never see or fill this. */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <button
        type="submit"
        disabled={state === "sending"}
        className="rounded-full bg-brand px-7 py-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60"
      >
        {state === "sending" ? "Sending…" : "Send message"}
      </button>
      <p role="status" className="text-sm">
        {state === "done" && <span className="text-green-700">Thanks — we will get back to you shortly.</span>}
        {state === "error" && <span className="text-red-700">{error}</span>}
      </p>
    </form>
  );
}
