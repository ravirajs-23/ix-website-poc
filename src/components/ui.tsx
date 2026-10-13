import Link from "next/link";
import type { ReactNode } from "react";
import type { Cta } from "@/blocks/types";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-5 sm:px-8 ${className}`}>{children}</div>;
}

export function Section({
  children,
  tone = "light",
  id,
  className = "",
  labelledBy,
}: {
  children: ReactNode;
  tone?: "light" | "surface" | "dark";
  id?: string;
  className?: string;
  labelledBy?: string;
}) {
  const bg =
    tone === "dark" ? "bg-navy text-white" : tone === "surface" ? "bg-surface" : "bg-white";
  return (
    <section id={id} aria-labelledby={labelledBy} className={`${bg} py-16 sm:py-24 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  heading,
  intro,
  tone = "light",
  id,
  align = "left",
}: {
  eyebrow?: string;
  heading?: string;
  intro?: string;
  tone?: "light" | "dark";
  id?: string;
  align?: "left" | "center";
}) {
  if (!eyebrow && !heading && !intro) return null;
  const dark = tone === "dark";
  return (
    <div className={`reveal mb-10 max-w-3xl sm:mb-14 ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow && (
        <p className={`mb-3 text-sm font-semibold uppercase tracking-[0.18em] ${dark ? "text-sky-300" : "text-link"}`}>
          {eyebrow}
        </p>
      )}
      {heading && (
        <h2 id={id} className="text-3xl font-semibold leading-tight sm:text-5xl">
          {heading}
        </h2>
      )}
      {intro && <p className={`mt-4 text-lg leading-relaxed ${dark ? "text-slate-300" : "text-muted"}`}>{intro}</p>}
    </div>
  );
}

export function Button({
  cta,
  onDark = false,
  className = "",
}: {
  cta: Cta;
  onDark?: boolean;
  className?: string;
}) {
  const primary = (cta.style ?? "primary") === "primary";
  const styles = primary
    ? "bg-brand text-white hover:bg-brand-deep"
    : onDark
      ? "border border-white/40 text-white hover:bg-white/10"
      : "border border-ink/20 text-ink hover:bg-surface";
  const external = /^https?:\/\//.test(cta.href);
  const cls = `inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-colors ${styles} ${className}`;
  const inner = (
    <>
      {cta.label}
      <span aria-hidden="true">{cta.arrow === "down" ? "↓" : "→"}</span>
    </>
  );
  return external ? (
    <a href={cta.href} className={cls} rel="noopener noreferrer" target="_blank">
      {inner}
    </a>
  ) : (
    <Link href={cta.href} className={cls}>
      {inner}
    </Link>
  );
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Escape "<" so content can never close the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
