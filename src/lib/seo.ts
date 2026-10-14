import type { Metadata } from "next";
import { NOINDEX, absoluteUrl, site } from "./site";

export function buildMetadata({
  title,
  description,
  path,
  noindex,
  type = "website",
}: {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
  type?: "website" | "article";
}): Metadata {
  const url = absoluteUrl(path);
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: noindex || NOINDEX ? { index: false, follow: false } : { index: true, follow: true },
    openGraph: { title, description, url, siteName: site.name, type, locale: "en_US" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export const organizationLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${absoluteUrl("/")}#organization`,
  name: site.name,
  legalName: site.legalName,
  url: absoluteUrl("/"),
  logo: absoluteUrl("/icon.svg"),
  description: site.description,
  email: site.email,
  telephone: site.phone,
  foundingDate: "2017",
  sameAs: Object.values(site.socials),
  address: {
    "@type": "PostalAddress",
    streetAddress: site.address.street,
    postalCode: site.address.postalCode,
    addressLocality: site.address.locality,
    addressRegion: site.address.region,
    addressCountry: site.address.country,
  },
};

export const websiteLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${absoluteUrl("/")}#website`,
  url: absoluteUrl("/"),
  name: site.name,
  description: site.description,
  inLanguage: site.locale,
  publisher: { "@id": `${absoluteUrl("/")}#organization` },
};

export function breadcrumbLd(crumbs: { name: string; href: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: absoluteUrl(c.href),
    })),
  };
}

export function webPageLd(args: { type: string; name: string; description: string; path: string }) {
  return {
    "@context": "https://schema.org",
    "@type": args.type,
    name: args.name,
    description: args.description,
    url: absoluteUrl(args.path),
    isPartOf: { "@id": `${absoluteUrl("/")}#website` },
    about: { "@id": `${absoluteUrl("/")}#organization` },
    inLanguage: site.locale,
  };
}
