import type { Block } from "./types";

/**
 * Machine-readable block catalog. The phase-2 agent reads this to map sections of a reference
 * page onto existing blocks. If nothing fits, it proposes a new block (needs developer review).
 */
/** Every block also accepts: anchor (jump target id) and bg (light|surface|dark section background; blocks that only support light/surface ignore dark). */
export const blockCatalog: Record<Block["type"], string> = {
  hero: "Top-of-page banner. One per page; renders the only <h1>. Variants: dark (immersive; optional badge, accentWord, watermark), split (headline left, text right), light (breadcrumb + large headline). pinned=true keeps it fixed while the page scrolls over it (md+); size xl gives a taller hero with an oversized headline (dark variant). CTA href can be an #anchor to a block with anchor set.",
  stats: "Row of big numbers with labels and optional sub-notes (years, clients, ratings). layout split puts the intro paragraph beside the heading. Use for at-a-glance / proof bands.",
  cardGrid: "2-4 column grid of titled cards with optional link and tag. variant portrait = image-first people/team cards (use for leadership). Use for services, values, offerings.",
  iconGrid: "Grid of icon + title + short text. Use for perks/benefits, security/compliance, differentiators.",
  featureList: "Numbered list of short statements. variant zigzag = alternating image/text rows with angled image masks (give each item an image). Use for why-join / why-us.",
  testimonials: "Quotes from the Testimonials collection. carousel (two-up slider, or split=true: heading+cta left, single slide right), grid (review wall; initial=N then Show all), spotlight (one giant quote + selectable list, dark).",
  caseStudies: "Case-study cards from the Case Studies collection. filterable=true adds By Service / By Industry filter chips; align center + size lg give a centred header with a large toggle and icon chips; hint adds a helper line under the chips.",
  tabs: "Audience or topic tabs with title, body, optional points (tick-list) and quote. layout rail = vertical rail on desktop that becomes an accordion on mobile; pills = horizontal tabs.",
  jobs: "Open roles from the Jobs collection; each links to its own job page. applyLabel adds an Apply button per card; footer adds a closing row with a button; featuredOnly limits to featured roles.",
  faq: "Accordion of questions and answers. singleOpen keeps one answer open at a time. Also emits FAQPage structured data.",
  badges: "Text badges for awards, recognitions, certifications, technology partners. variant marquee = auto-scrolling strip (pauses on hover, static for reduced motion).",
  process: "Numbered steps describing how work gets done (delivery process, interview process).",
  richText: "Long-form paragraphs with optional callout box. lead adds a bold one-line summary under the heading; media adds a side image (media.frame adds an offset brand-colour block behind it); align center for centred statements; cta adds a button. Use for origin story, policies, split text + photo sections like How we work.",
  cta: "Closing call-to-action band with primary/secondary buttons.",
  collage: "Staggered image/caption tiles for culture and life-at-company storytelling.",
  locations: "List of offices with city and detail.",
  contact: "Contact details plus enquiry form.",
};
