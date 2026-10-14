// Central site configuration. Replace SITE_URL via env when the production domain is decided.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

/**
 * Set NEXT_PUBLIC_NOINDEX=true on demo/staging deployments: every page gets a noindex meta tag and
 * robots.txt disallows all crawlers, so the demo link stays out of search results and AI indexes.
 * Leave it unset for the real launch.
 */
export const NOINDEX = process.env.NEXT_PUBLIC_NOINDEX === "true";

export const site = {
  name: "IncubXperts",
  legalName: "IncubXperts TechnoConsulting Private Limited",
  tagline: "AI-Native Engineering & Software Partner",
  description:
    "IncubXperts is an AI-native engineering partner for product companies and enterprises, helping them design, build, and scale intelligent software.",
  url: SITE_URL,
  email: "engage@incubxperts.com",
  phone: "+91 70283 34754",
  locale: "en",
  socials: {
    linkedin: "https://www.linkedin.com/company/incubxperts/",
    instagram: "https://www.instagram.com/incubxperts/",
    x: "https://x.com/incubxperts",
  } as Record<string, string>,
  address: {
    street: "Office No 1, Level 5, Building B1, Symphony IT Park, Nanded City",
    locality: "Pune",
    region: "Maharashtra",
    postalCode: "411068",
    country: "IN",
  },
};

export type NavItem = { label: string; href: string };

export const nav: NavItem[] = [
  { label: "Services", href: "/services" },
  { label: "Work", href: "/work" },
  { label: "About", href: "/about" },
  { label: "Careers", href: "/careers" },
];

export const footerNav: { title: string; links: NavItem[] }[] = [
  {
    title: "Company",
    links: [
      { label: "About us", href: "/about" },
      { label: "Careers", href: "/careers" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Work",
    links: [{ label: "Case studies", href: "/work" }],
  },
  {
    title: "Legal",
    links: [{ label: "Privacy policy", href: "/privacy" }],
  },
];

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
