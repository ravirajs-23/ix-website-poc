"use client";

import Link from "next/link";
import { useState } from "react";
import { nav, site } from "@/lib/site";
import { Container } from "./ui";

export function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-navy/95 text-white backdrop-blur">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-4 focus:py-2 focus:text-ink"
      >
        Skip to content
      </a>
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl font-semibold tracking-tight" onClick={() => setOpen(false)}>
          {site.name}
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm font-medium text-slate-200 hover:text-white">
              {n.label}
            </Link>
          ))}
          <Link href="/contact" className="rounded-full bg-brand px-5 py-2 text-sm font-semibold hover:bg-brand-deep">
            Contact us
          </Link>
        </nav>
        <div className="flex items-center gap-1 md:hidden">
          <Link
            href="/contact"
            onClick={() => setOpen(false)}
            className="rounded-full bg-brand px-4 py-1.5 text-sm font-semibold hover:bg-brand-deep"
          >
            Contact
          </Link>
        <button
          type="button"
          className="rounded p-2"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d={open ? "M6 6l12 12M18 6L6 18" : "M4 7h16M4 12h16M4 17h16"} />
          </svg>
        </button>
        </div>
      </Container>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-white/10 md:hidden">
          <Container className="flex flex-col py-3">
            {[...nav, { label: "Contact us", href: "/contact" }].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-3 text-base font-medium text-slate-100"
              >
                {n.label}
              </Link>
            ))}
          </Container>
        </nav>
      )}
    </header>
  );
}
