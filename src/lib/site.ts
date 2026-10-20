import navigation from "@/content/navigation.json";

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

// Menus live in src/content/navigation.json so they can be edited without touching code
// (the page factory's `edit menu` command writes that file).
export const nav: NavItem[] = navigation.header;

export const footerNav: { title: string; links: NavItem[] }[] = navigation.footer;

export function absoluteUrl(path = "/") {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
