/**
 * Stage 4 — APPLY a draft to the site (new page or inserted section), validate it, and report.
 *
 * Safety: the site is never left broken. If validation fails, the change is rolled back and the errors are returned.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockSchema, pageSchema, type Block, type PageDefinition } from "../../src/blocks/schema.ts";
import { z } from "zod";
import type { ContentBundle } from "./content.mts";
import { checkGrounding, groundingReport, type GroundingResult } from "./ground.mts";
import { localizeImagesIn } from "./media.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pagesDir = path.join(root, "src", "content", "pages");

export type InsertSpec = { after?: string; before?: string; at?: "start" | "end"; index?: number };
export type RunMeta = {
  mode: "page" | "section";
  slug?: string;
  title?: string;
  pageSlug?: string;
  referenceUrl: string;
  refSection?: string;
  contentSpecs: string[];
  insert?: InsertSpec;
  nav?: string;
  createdAt: string;
};
export type ApplyResult = { ok: boolean; files: string[]; errors: string[]; warnings: string[]; grounding: GroundingResult; summary: string };

const blockLabel = (b: Block) => {
  const x = b as unknown as Record<string, unknown>;
  return [x.heading, x.eyebrow, x.title, x.id, x.anchor, b.type].filter((v) => typeof v === "string").join(" ").toLowerCase();
};

/** Where to insert, as an index into page.blocks (never before the hero). */
export function resolveInsertIndex(page: PageDefinition, spec: InsertSpec | undefined): { index: number; description: string } {
  const blocks = page.blocks;
  const find = (needle: string) => {
    const n = needle.toLowerCase();
    const typed = n.startsWith("type:") ? n.slice(5) : undefined;
    const i = blocks.findIndex((b) => (typed ? b.type === typed : blockLabel(b).includes(n)));
    if (i < 0) throw new Error(`Cannot find a block matching "${needle}" on the page. Blocks: ${blocks.map((b, k) => `#${k} ${b.type}${(b as { heading?: string }).heading ? ` "${(b as { heading?: string }).heading}"` : ""}`).join(" | ")}`);
    return i;
  };
  if (spec?.index !== undefined) return { index: Math.max(1, Math.min(spec.index, blocks.length)), description: `at index ${spec.index}` };
  if (spec?.after) return { index: find(spec.after) + 1, description: `after the "${spec.after}" section` };
  if (spec?.before) return { index: Math.max(1, find(spec.before)), description: `before the "${spec.before}" section` };
  if (spec?.at === "start") return { index: 1, description: "right after the hero" };
  // default: before the closing CTA if there is one, else at the end
  const last = blocks.length - 1;
  if (spec?.at !== "end" && blocks[last]?.type === "cta") return { index: last, description: "before the closing call-to-action" };
  return { index: blocks.length, description: "at the end of the page" };
}

function runValidator(): { errors: string[]; warnings: string[] } {
  const r = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "scripts/validate-pages.mts"], { cwd: root, encoding: "utf8" });
  const lines = `${r.stdout}\n${r.stderr}`.split("\n").map((l) => l.trim());
  return {
    errors: lines.filter((l) => l.startsWith("ERROR")).map((l) => l.replace(/^ERROR\s+/, "")),
    warnings: lines.filter((l) => l.startsWith("warn")).map((l) => l.replace(/^warn\s+/, "")),
  };
}

export async function applyDraft(args: {
  meta: RunMeta;
  draft: unknown;
  content: ContentBundle;
  runDir: string;
  force?: boolean;
  strictGrounding?: boolean;
  log?: (m: string) => void;
}): Promise<ApplyResult> {
  const { meta, runDir } = args;
  const log = args.log ?? (() => {});
  const touched: { file: string; before: string | null }[] = [];
  const rollback = () => {
    for (const t of touched.reverse()) {
      if (t.before === null) rmSync(t.file, { force: true });
      else writeFileSync(t.file, t.before);
    }
  };
  const fail = (errors: string[], grounding: GroundingResult): ApplyResult => ({ ok: false, files: [], errors, warnings: [], grounding, summary: "rolled back" });
  const emptyGrounding: GroundingResult = { checked: 0, grounded: 0, ungrounded: [] };

  // 1) shape check of the model output
  const draft = args.draft as { page?: unknown; blocks?: unknown; rationale?: string };
  let file: string;
  let finalPage: PageDefinition;
  let generated: unknown;
  let description = "";

  if (meta.mode === "page") {
    const parsed = pageSchema.safeParse(draft.page);
    if (!parsed.success) return fail(parsed.error.issues.map((i) => `draft.page.${i.path.join(".")}: ${i.message}`), emptyGrounding);
    const page = parsed.data;
    const expected = `/${meta.slug}`;
    if (page.path !== expected) return fail([`page.path must be "${expected}" (got "${page.path}")`], emptyGrounding);
    file = path.join(pagesDir, `${meta.slug}.json`);
    if (existsSync(file) && !args.force) return fail([`${path.relative(root, file)} already exists. Use --force to replace it, or pick another slug.`], emptyGrounding);
    finalPage = page;
    generated = page;
    description = `new page ${expected}`;
  } else {
    const blocksParsed = z.array(blockSchema).min(1).safeParse(draft.blocks);
    if (!blocksParsed.success) return fail(blocksParsed.error.issues.map((i) => `draft.blocks.${i.path.join(".")}: ${i.message}`), emptyGrounding);
    file = path.join(pagesDir, `${meta.pageSlug}.json`);
    if (!existsSync(file)) return fail([`target page ${meta.pageSlug}.json does not exist`], emptyGrounding);
    const existing = pageSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    const { index, description: where } = resolveInsertIndex(existing, meta.insert);
    // Anchors must stay unique on the page.
    const taken = new Set(existing.blocks.map((b) => b.anchor).filter(Boolean));
    for (const b of blocksParsed.data) if (b.anchor && taken.has(b.anchor)) return fail([`anchor "${b.anchor}" already exists on ${meta.pageSlug}; choose another`], emptyGrounding);
    if (blocksParsed.data.some((b) => b.type === "hero")) return fail(["a section must not contain a hero block (the page already has one)"], emptyGrounding);
    finalPage = { ...existing, blocks: [...existing.blocks.slice(0, index), ...blocksParsed.data, ...existing.blocks.slice(index)] };
    generated = blocksParsed.data;
    description = `${blocksParsed.data.length} block(s) ${where} on /${meta.pageSlug === "home" ? "" : meta.pageSlug}`;
  }

  // 2) grounding (advisory unless strict)
  const grounding = checkGrounding(generated, args.content);
  if (args.strictGrounding && grounding.ungrounded.length) return fail(["strict grounding: " + groundingReport(grounding)], grounding);

  // 3) images: CMS uploads get neutral local copies
  const n = await localizeImagesIn(finalPage, log);
  if (n) log(`${n} image(s) copied locally with neutral names`);

  // 4) write, validate, roll back on failure
  mkdirSync(pagesDir, { recursive: true });
  touched.push({ file, before: existsSync(file) ? readFileSync(file, "utf8") : null });
  writeFileSync(path.join(runDir, "before.json"), touched[0].before ?? "null\n");
  writeFileSync(file, JSON.stringify(finalPage, null, 2) + "\n");
  if (meta.mode === "page" && meta.nav) {
    const siteFile = path.join(root, "src", "lib", "site.ts");
    const src = readFileSync(siteFile, "utf8");
    const re = /(export const nav: NavItem\[\] = \[\r?\n)([\s\S]*?)(\];)/;
    if (re.test(src) && !src.includes(`href: "/${meta.slug}"`)) {
      touched.push({ file: siteFile, before: src });
      writeFileSync(siteFile, src.replace(re, (_m, a, body, c) => `${a}${body}  { label: ${JSON.stringify(meta.nav)}, href: "/${meta.slug}" },\n${c}`));
    }
  }
  const v = runValidator();
  if (v.errors.length) {
    rollback();
    return { ok: false, files: [], errors: v.errors, warnings: v.warnings, grounding, summary: "validation failed; rolled back" };
  }
  return { ok: true, files: touched.map((t) => path.relative(root, t.file)), errors: [], warnings: v.warnings, grounding, summary: description };
}
