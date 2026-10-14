import { z } from "zod";

/**
 * SINGLE SOURCE OF TRUTH for page and block shapes.
 *
 *  - TypeScript types in ./types.ts are inferred from these schemas.
 *  - `npm run validate:pages` (and `npm run build`) validate every src/content/pages/*.json against them.
 *  - The phase-2 page-generating agent and the /new-page skill author JSON that must pass this schema.
 *
 * All objects are strict: unknown keys are errors, so typos and invented props never ship silently.
 * Plain `zod` only (no Next/React imports) so this file also runs under plain Node.
 */

export const toneSchema = z.enum(["light", "surface", "dark"]);
export type Tone = z.infer<typeof toneSchema>;

export const ctaSchema = z.strictObject({
  label: z.string().min(1),
  href: z.string().min(1),
  style: z.enum(["primary", "secondary"]).optional(),
  arrow: z.enum(["right", "down"]).optional(),
});
export type Cta = z.infer<typeof ctaSchema>;

export const imageSchema = z.strictObject({
  src: z.string().min(1),
  /** Required: meaningful alt text (accessibility + SEO). */
  alt: z.string().min(3),
});
export type ImageRef = z.infer<typeof imageSchema>;

export const iconNames = [
  "heart", "brain", "cash", "headset", "trend", "bulb", "laptop", "shield", "lock", "globe",
  "users", "rocket", "book", "check", "pie", "award", "code", "cloud", "data", "sparkles",
] as const;
export const iconSchema = z.enum(iconNames);
export type IconName = z.infer<typeof iconSchema>;

const columns = z.union([z.literal(2), z.literal(3), z.literal(4)]);

/** `anchor` makes a block a jump target (hero CTA href "#case-studies"). */
const baseShape = {
  id: z.string().optional(),
  anchor: z.string().regex(/^[a-z][a-z0-9-]*$/).optional(),
};
/** `bg` overrides a block's default section background (alternate light/dark rhythm). */
const headingShape = {
  ...baseShape,
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  intro: z.string().optional(),
  bg: toneSchema.optional(),
};

export const heroSchema = z.strictObject({
  type: z.literal("hero"),
  ...baseShape,
  variant: z.enum(["dark", "split", "light"]),
  eyebrow: z.string().optional(),
  title: z.string().min(1),
  /** A word inside `title` rendered in the accent colour. */
  accentWord: z.string().optional(),
  /** Giant outlined ghost text behind the headline (dark variant). */
  watermark: z.string().optional(),
  /** Hero stays fixed while the rest of the page scrolls over it (md+ screens only). */
  pinned: z.boolean().optional(),
  subtitle: z.string().optional(),
  ctas: z.array(ctaSchema).optional(),
  badge: z.strictObject({ value: z.string(), label: z.string() }).optional(),
  image: imageSchema.optional(),
});

export const statsSchema = z.strictObject({
  type: z.literal("stats"),
  ...headingShape,
  tone: z.enum(["dark", "light"]).optional(),
  /** split: heading on the left, intro paragraph on the right. */
  layout: z.enum(["stacked", "split"]).optional(),
  items: z.array(z.strictObject({ value: z.string(), label: z.string(), note: z.string().optional() })).min(1),
});

export const cardGridSchema = z.strictObject({
  type: z.literal("cardGrid"),
  ...headingShape,
  /** portrait: image-first people/team cards (4 columns, 2 on mobile). */
  variant: z.enum(["cards", "portrait"]).optional(),
  columns: columns.optional(),
  items: z
    .array(
      z.strictObject({
        title: z.string(),
        body: z.string(),
        href: z.string().optional(),
        linkLabel: z.string().optional(),
        tag: z.string().optional(),
        image: imageSchema.optional(),
      }),
    )
    .min(1),
});

export const iconGridSchema = z.strictObject({
  type: z.literal("iconGrid"),
  ...headingShape,
  columns: columns.optional(),
  tone: z.enum(["light", "dark"]).optional(),
  items: z.array(z.strictObject({ icon: iconSchema, title: z.string(), body: z.string().optional() })).min(1),
});

export const featureListSchema = z.strictObject({
  type: z.literal("featureList"),
  ...headingShape,
  /** zigzag: alternating image/text rows with angled image masks. */
  variant: z.enum(["grid", "zigzag"]).optional(),
  items: z.array(z.strictObject({ title: z.string(), body: z.string().optional(), image: imageSchema.optional() })).min(1),
});

export const testimonialsSchema = z.strictObject({
  type: z.literal("testimonials"),
  ...headingShape,
  /** carousel: scroll-snap slider; grid: review wall; spotlight: one giant quote + selectable list. */
  variant: z.enum(["carousel", "grid", "spotlight"]).optional(),
  limit: z.number().int().positive().optional(),
  /** grid: show this many first, then a "Show all" button. */
  initial: z.number().int().positive().optional(),
  /** carousel: heading/intro/cta in a left rail, one slide visible with arrows on top. */
  split: z.boolean().optional(),
  cta: ctaSchema.optional(),
});

export const caseStudiesSchema = z.strictObject({
  type: z.literal("caseStudies"),
  ...headingShape,
  filterable: z.boolean().optional(),
  limit: z.number().int().positive().optional(),
  viewAll: ctaSchema.optional(),
});

export const tabsSchema = z.strictObject({
  type: z.literal("tabs"),
  ...headingShape,
  /** pills: horizontal tabs; rail: vertical rail on md+, accordion on mobile. */
  layout: z.enum(["pills", "rail"]).optional(),
  tabs: z
    .array(
      z.strictObject({
        label: z.string(),
        title: z.string(),
        body: z.string(),
        /** Optional tick-list shown in the panel. */
        points: z.array(z.string()).optional(),
        quote: z.strictObject({ text: z.string(), name: z.string(), role: z.string() }).optional(),
        cta: ctaSchema.optional(),
      }),
    )
    .min(1),
});

export const jobsSchema = z.strictObject({
  type: z.literal("jobs"),
  ...headingShape,
  featuredOnly: z.boolean().optional(),
  /** Adds an "Apply" button to each job card. */
  applyLabel: z.string().optional(),
  /** Footer row under the cards: text plus a button. */
  footer: z.strictObject({ text: z.string(), cta: ctaSchema }).optional(),
  viewAll: ctaSchema.optional(),
});

export const faqSchema = z.strictObject({
  type: z.literal("faq"),
  ...headingShape,
  /** Only one answer open at a time. */
  singleOpen: z.boolean().optional(),
  items: z.array(z.strictObject({ q: z.string(), a: z.string() })).min(1),
});

export const badgesSchema = z.strictObject({
  type: z.literal("badges"),
  ...headingShape,
  /** marquee: auto-scrolling strip (pauses on hover, static for reduced-motion users). */
  variant: z.enum(["grid", "marquee"]).optional(),
  items: z.array(z.strictObject({ name: z.string(), label: z.string().optional() })).min(1),
});

export const processSchema = z.strictObject({
  type: z.literal("process"),
  ...headingShape,
  steps: z.array(z.strictObject({ title: z.string(), body: z.string() })).min(1),
});

export const richTextSchema = z.strictObject({
  type: z.literal("richText"),
  ...headingShape,
  paragraphs: z.array(z.string()).min(1),
  callout: z.strictObject({ title: z.string(), body: z.string() }).optional(),
  /** Image beside the text. */
  media: z.strictObject({ image: imageSchema, side: z.enum(["left", "right"]).optional() }).optional(),
  align: z.enum(["left", "center"]).optional(),
  cta: ctaSchema.optional(),
});

export const ctaBlockSchema = z.strictObject({
  type: z.literal("cta"),
  ...baseShape,
  eyebrow: z.string().optional(),
  heading: z.string().min(1),
  body: z.string().optional(),
  primary: ctaSchema,
  secondary: ctaSchema.optional(),
});

export const collageSchema = z.strictObject({
  type: z.literal("collage"),
  ...headingShape,
  items: z.array(z.strictObject({ caption: z.string(), image: imageSchema.optional() })).min(1),
});

export const locationsSchema = z.strictObject({
  type: z.literal("locations"),
  ...headingShape,
  items: z.array(z.strictObject({ city: z.string(), detail: z.string().optional() })).min(1),
});

export const contactSchema = z.strictObject({
  type: z.literal("contact"),
  ...headingShape,
  details: z.array(z.strictObject({ label: z.string(), value: z.string(), href: z.string().optional() })).min(1),
});

export const blockSchema = z.discriminatedUnion("type", [
  heroSchema, statsSchema, cardGridSchema, iconGridSchema, featureListSchema, testimonialsSchema,
  caseStudiesSchema, tabsSchema, jobsSchema, faqSchema, badgesSchema, processSchema, richTextSchema,
  ctaBlockSchema, collageSchema, locationsSchema, contactSchema,
]);

export const pageSchema = z.strictObject({
  /** "/" for home.json, otherwise "/<file-name>". */
  path: z.string().regex(/^\/([a-z0-9-]+(\/[a-z0-9-]+)*)?$/),
  /** TEMP provenance + review badge: which site this layout was modelled on. */
  reference: z.strictObject({ name: z.string(), url: z.string().url().optional() }).optional(),
  seo: z.strictObject({
    title: z.string().min(10),
    description: z.string().min(50),
    schemaType: z.enum(["WebPage", "AboutPage", "ContactPage", "CollectionPage"]).optional(),
    noindex: z.boolean().optional(),
    /** Short answer-style summary surfaced in llms.txt for AI search. */
    summary: z.string().optional(),
  }),
  blocks: z.array(blockSchema).min(1),
});

export type HeroBlock = z.infer<typeof heroSchema>;
export type StatsBlock = z.infer<typeof statsSchema>;
export type CardGridBlock = z.infer<typeof cardGridSchema>;
export type IconGridBlock = z.infer<typeof iconGridSchema>;
export type FeatureListBlock = z.infer<typeof featureListSchema>;
export type TestimonialsBlock = z.infer<typeof testimonialsSchema>;
export type CaseStudiesBlock = z.infer<typeof caseStudiesSchema>;
export type TabsBlock = z.infer<typeof tabsSchema>;
export type JobsBlock = z.infer<typeof jobsSchema>;
export type FaqBlock = z.infer<typeof faqSchema>;
export type BadgesBlock = z.infer<typeof badgesSchema>;
export type ProcessBlock = z.infer<typeof processSchema>;
export type RichTextBlock = z.infer<typeof richTextSchema>;
export type CtaBlock = z.infer<typeof ctaBlockSchema>;
export type CollageBlock = z.infer<typeof collageSchema>;
export type LocationsBlock = z.infer<typeof locationsSchema>;
export type ContactBlock = z.infer<typeof contactSchema>;
export type Block = z.infer<typeof blockSchema>;
export type PageDefinition = z.infer<typeof pageSchema>;
