/**
 * Stage 3 — GENERATE a page or section.
 *
 * Builds one "prompt pack" from: the reference capture (layout facts + screenshots), the content bundle (the ONLY
 * source of facts), the block catalog + strict JSON schema, our rules, and (section mode) the existing page.
 *
 *   engine "api"     sends the pack to Claude (needs ANTHROPIC_API_KEY) and forces a schema-shaped tool call
 *   engine "prompt"  writes the pack to disk for Claude Code (the /new-page and /add-section skills) to answer
 *
 * Either way the answer is a JSON draft that goes through `apply`, which validates it against the same schema.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { blockCatalog } from "../../src/blocks/catalog.ts";
import { blockSchema, pageSchema, type Block, type PageDefinition } from "../../src/blocks/schema.ts";
import type { ReferenceCapture } from "./capture.mts";
import type { ContentBundle } from "./content.mts";

export const DEFAULT_MODEL = process.env.FACTORY_MODEL ?? "claude-sonnet-5-5";

export const pageOutputSchema = z.strictObject({ page: pageSchema, rationale: z.string() });
export const sectionOutputSchema = z.strictObject({ blocks: z.array(blockSchema).min(1).max(4), rationale: z.string() });

export type Target =
  | { mode: "page"; slug: string; title: string }
  | { mode: "section"; pageSlug: string; page: PageDefinition; insertDescription: string };

const SYSTEM = `You are the page factory for the IncubXperts website. You turn (1) a REFERENCE page's layout, (2) our CONTENT and (3) our block library into JSON that renders on OUR theme.

HARD RULES
1. Layout only. Reproduce the reference's STRUCTURE, ordering, alignment, density, background rhythm and interactions using our blocks. Never reuse the reference's text, images, logos, icons or wording. Our colours and fonts come from our theme tokens; never describe or request colours.
2. Content integrity. Every piece of text you write must come from the CONTENT bundle: reuse its wording, or lightly condense or reorder it. Never invent facts, numbers, awards, certifications, clients, quotes, people, dates or locations. If the reference has a section our content cannot support, omit it and say so in "rationale".
3. Images: only use image URLs present in the CONTENT bundle (field images[].src). Give each a descriptive alt text (what is visible; no client or brand names). If no suitable image exists, omit the image.
4. Output only what the schema allows. Unknown properties are errors. Use block variants and options exactly as described in the catalog.
5. Page mode: exactly ONE hero block, first (it renders the only <h1>). SEO: title <= 60 chars, description 120-160 chars, one-sentence summary, correct schemaType. Set "reference" to the reference URL (name: "<site> — <page>").
6. Rhythm: alternate section backgrounds (bg: light / surface / dark) the way the reference alternates tone; use "anchor" on a block when a CTA should jump to it. Internal links must point to real pages (/, /work, /careers, /about, /contact, /privacy or a page in the existing site) or to an anchor on the same page.
7. Section mode: return only the NEW block(s) to insert (usually 1-2); do not repeat sections that already exist on the page; match the page's existing tone and rhythm.

HOW TO MAP REFERENCE LAYOUTS TO BLOCKS
- hero / large banner with H1 -> hero (variant dark | split | light; accentWord, watermark, size xl if it is oversized)
- text beside a photo (alternating) -> richText with media (side left | right; frame true for an offset colour block), lead for a bold one-liner, cta for a button
- grid of cards with images -> cardGrid; with icons and short text -> iconGrid; people -> cardGrid variant portrait
- numbered statements -> featureList (variant zigzag if alternating image rows)
- big numbers -> stats (layout split when the intro sits beside the heading)
- tabs / vertical rail -> tabs (layout rail); accordion / Q&A -> faq (singleOpen if only one opens at a time)
- carousel of quotes -> testimonials (variant carousel | spotlight | grid); filterable case-study grid -> caseStudies
- logos / awards strip -> badges (variant marquee for a scrolling strip); steps -> process; offices -> locations; closing call to action -> cta; contact form -> contact

BLOCK CATALOG
${Object.entries(blockCatalog).map(([k, v]) => `- ${k}: ${v}`).join("\n")}`;

export type PromptPack = {
  system: string;
  user: string;
  images: { path: string; label: string }[];
  toolName: string;
  toolSchema: Record<string, unknown>;
};

/** Reference sections to show the model: all of them in page mode, or just the matched ones in section mode. */
export function selectReferenceSections(ref: ReferenceCapture, match?: string) {
  if (!match) return ref.sections.slice(0, 14);
  const needle = match.toLowerCase();
  const hits = ref.sections.filter((s) => s.headings.some((h) => h.text.toLowerCase().includes(needle)) || (s.eyebrow ?? "").toLowerCase().includes(needle));
  if (!hits.length)
    throw new Error(`No reference section matches "${match}". Sections found: ${ref.sections.map((s) => `#${s.index} ${s.headings[0]?.text ?? "(untitled)"}`).join(" | ")}`);
  return hits;
}

export function buildPromptPack(args: {
  target: Target;
  reference: ReferenceCapture;
  referenceDir: string;
  refSectionMatch?: string;
  content: ContentBundle;
  /** Free-text instructions from the requester (tone, emphasis, constraints). */
  notes?: string;
  retry?: { previousDraft: unknown; errors: string[] };
}): PromptPack {
  const { target, reference, content } = args;
  const refSections = selectReferenceSections(reference, args.refSectionMatch);
  const out = target.mode === "page" ? pageOutputSchema : sectionOutputSchema;
  const toolSchema = z.toJSONSchema(out, { target: "draft-7" }) as Record<string, unknown>;
  delete toolSchema.$schema;

  const parts: string[] = [];
  parts.push(
    target.mode === "page"
      ? `TASK: create a NEW page "${target.title}" at path /${target.slug}, modelled on the reference page's layout.`
      : `TASK: create new section block(s) for the existing page "${target.pageSlug}", modelled on the reference section(s) below. Insert position: ${target.insertDescription}.`,
  );
  parts.push(`REFERENCE (${reference.url}) — structure only; text is truncated on purpose and must NOT be reused:\n${JSON.stringify({ title: reference.title, sections: refSections.map((s) => Object.fromEntries(Object.entries(s).filter(([k]) => k !== "screenshot"))) }, null, 1)}`);
  parts.push(`CONTENT (the ONLY source of facts and images). Sources: ${content.sources.join(", ")}\n${JSON.stringify(content.sections, null, 1)}`);
  if (args.notes) parts.push(`REQUESTER NOTES (follow these unless they conflict with the hard rules):
${args.notes}`);
  if (target.mode === "section") parts.push(`EXISTING PAGE JSON (do not repeat what is already there; match its rhythm):\n${JSON.stringify(target.page, null, 1)}`);
  if (args.retry) parts.push(`YOUR PREVIOUS DRAFT FAILED VALIDATION. Fix every error and return the corrected full output.\nPrevious draft:\n${JSON.stringify(args.retry.previousDraft)}\nErrors:\n${args.retry.errors.map((e) => `- ${e}`).join("\n")}`);

  const images = refSections
    .filter((s) => s.screenshot)
    .slice(0, 6)
    .map((s) => ({ path: path.join(args.referenceDir, s.screenshot as string), label: `reference section #${s.index} (${s.headings[0]?.text ?? "untitled"})` }));

  return { system: SYSTEM, user: parts.join("\n\n"), images, toolName: "emit_result", toolSchema };
}

/** Write the pack to disk (engine "prompt"). Claude Code answers it, then `apply` consumes the draft. */
export function writePromptPack(pack: PromptPack, dir: string, target: Target) {
  writeFileSync(path.join(dir, "output.schema.json"), JSON.stringify(pack.toolSchema, null, 2) + "\n");
  const md = [
    "# Page factory — prompt pack",
    "",
    "Answer this by writing **draft.json** in this folder, then run `npm run factory -- apply --run <this folder>`.",
    "",
    `Output shape: ${target.mode === "page" ? '{ "page": <PageDefinition>, "rationale": "..." }' : '{ "blocks": [<Block>, ...], "rationale": "..." }'}  (JSON Schema: output.schema.json)`,
    "",
    "## Reference screenshots (view these)",
    ...pack.images.map((i) => `- ${i.path}  — ${i.label}`),
    "",
    "## System instructions",
    "",
    pack.system,
    "",
    "## Task and inputs",
    "",
    pack.user,
    "",
  ].join("\n");
  writeFileSync(path.join(dir, "prompt.md"), md);
}

/** Engine "api": one forced tool call. Returns the parsed tool input (not yet validated against our schema). */
export async function callApi(pack: PromptPack, opts: { model?: string; log?: (m: string) => void } = {}): Promise<{ output: unknown; usage: { input: number; output: number } }> {
  if (!process.env.ANTHROPIC_API_KEY)
    throw new Error("engine api needs ANTHROPIC_API_KEY. Set it in your shell or .env.local — or use --engine prompt (no key; Claude Code answers the prompt pack).");
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic();
  const content: Array<
    { type: "text"; text: string } | { type: "image"; source: { type: "base64"; media_type: "image/jpeg"; data: string } }
  > = [];
  for (const img of pack.images) {
    content.push({ type: "text", text: img.label });
    content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: readFileSync(img.path).toString("base64") } });
  }
  content.push({ type: "text", text: pack.user });
  const model = opts.model ?? DEFAULT_MODEL;
  opts.log?.(`calling ${model} (${pack.images.length} screenshots)`);
  const res = await client.messages.create({
    model,
    max_tokens: 16000,
    system: pack.system,
    tools: [{ name: pack.toolName, description: "Return the finished result in exactly this shape.", input_schema: pack.toolSchema as never }],
    tool_choice: { type: "tool", name: pack.toolName },
    messages: [{ role: "user", content }],
  });
  const tool = res.content.find((c) => c.type === "tool_use");
  if (!tool || tool.type !== "tool_use") throw new Error("the model did not return a tool result");
  return { output: tool.input, usage: { input: res.usage.input_tokens, output: res.usage.output_tokens } };
}

export type { Block, PageDefinition };
