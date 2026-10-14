/**
 * Block and page types are inferred from the zod schemas in ./schema.ts (single source of truth).
 * Edit schema.ts — not this file — to add or change a block. Also update catalog.ts (agent guidance).
 */
export type {
  Block, BadgesBlock, CardGridBlock, CaseStudiesBlock, CollageBlock, ContactBlock, Cta, CtaBlock,
  FaqBlock, FeatureListBlock, HeroBlock, IconGridBlock, IconName, ImageRef, JobsBlock,
  LocationsBlock, PageDefinition, ProcessBlock, RichTextBlock, StatsBlock, TabsBlock,
  TestimonialsBlock, Tone,
} from "./schema";
