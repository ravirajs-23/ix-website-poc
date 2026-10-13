import Link from "next/link";
import { cacheLife } from "next/cache";
import { footerNav, site } from "@/lib/site";
import { Container } from "./ui";

export async function Footer() {
  "use cache";
  cacheLife("days");
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy text-slate-300">
      <Container className="grid gap-10 py-14 md:grid-cols-[1.5fr_repeat(3,1fr)]">
        <div>
          <p className="font-display text-2xl font-semibold text-white">{site.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            {site.tagline}. {site.description}
          </p>
          <p className="mt-4 text-sm">
            <a className="hover:text-white" href={`mailto:${site.email}`}>
              {site.email}
            </a>
          </p>
        </div>
        {footerNav.map((col) => (
          <nav key={col.title} aria-label={col.title}>
            <p className="text-sm font-semibold uppercase tracking-wider text-white">{col.title}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="hover:text-white">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <div className="border-t border-white/10 py-5 text-center text-xs">
        © {year} {site.legalName}. All rights reserved.
      </div>
    </footer>
  );
}
