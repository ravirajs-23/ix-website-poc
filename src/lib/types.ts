// Shapes of content that lives in Strapi (with local JSON fallback in src/content/data).
// Keep these in sync with the Strapi content types in /strapi-schemas.

export type CaseStudy = {
  slug: string;
  title: string;
  client: string;
  industries: string[];
  services: string[];
  summary: string;
  challenge?: string;
  solution?: string;
  solutionPoints?: string[];
  techStack?: string[];
  results?: string[];
  image?: string;
  imageAlt?: string;
  publishedAt: string; // ISO date
  publishedOn?: string; // Strapi custom date field; preferred over publishedAt when present
};

export type Job = {
  slug: string;
  title: string;
  department: string;
  location: string;
  employmentType: "FULL_TIME" | "PART_TIME" | "CONTRACTOR" | "INTERN";
  experience: string;
  summary: string;
  responsibilities: string[];
  requirements: string[];
  featured?: boolean;
  /** Placeholder listing: shown with an "Example role" label, never emitted as JobPosting data, noindex, not in sitemap/llms.txt. */
  example?: boolean;
  postedAt: string; // ISO date
  validThrough?: string; // ISO date
};

export type Testimonial = {
  name: string;
  title: string;
  company?: string;
  quote: string;
  caseStudySlug?: string;
};
