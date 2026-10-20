import Link from "next/link";
import { cacheLife } from "next/cache";
import { footerNav, site } from "@/lib/site";
import { Container } from "./ui";

const socialLabels: Record<string, string> = { linkedin: "LinkedIn", instagram: "Instagram", x: "X (Twitter)" };

export async function Footer() {
  "use cache";
  cacheLife("days");
  const year = new Date().getFullYear();
  return (
    <footer className="bg-navy text-slate-300">
      <Container className="grid gap-10 py-14 md:grid-cols-2 lg:grid-cols-[1.6fr_repeat(3,1fr)_1.4fr]">
        <div className="md:col-span-2 lg:col-span-1">
          <p className="font-display text-2xl font-semibold text-white">{site.name}</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed">
            {site.tagline}. {site.description}
          </p>
          <ul className="mt-5 flex gap-3" aria-label="Social media">
            {Object.entries(site.socials).map(([key, href]) => (
              <li key={key}>
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex rounded-full border border-white/20 px-3.5 py-1.5 text-xs font-semibold text-slate-200 hover:border-white/60 hover:text-white"
                >
                  {socialLabels[key] ?? key}
                </a>
              </li>
            ))}
          </ul>
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
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-white">Get in touch</p>
          <address className="mt-4 space-y-2 text-sm not-italic">
            <p>
              {site.address.street}, {site.address.locality}, {site.address.region} {site.address.postalCode}, India
            </p>
            <p>
              <a className="hover:text-white" href={`tel:${site.phone.replace(/\s/g, "")}`}>
                {site.phone}
              </a>
            </p>
            <p>
              <a className="hover:text-white" href={`mailto:${site.email}`}>
                {site.email}
              </a>
            </p>
          </address>
        </div>
      </Container>
      <div className="border-t border-white/10 py-5 text-center text-xs">
        © {year} {site.legalName}. All rights reserved.
      </div>
    </footer>
  );
}
