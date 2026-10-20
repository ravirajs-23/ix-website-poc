/**
 * EDIT operations: change what is already on the site without a reference page or generation.
 *
 *   list · move-section · remove-section · update (text / layout fields) · replace-image · remove-page · menu
 *
 * Every operation is a two-step: `plan()` works out the exact file changes and a plain-language preview (nothing is
 * written), `commit()` writes them, runs the site validator and undoes everything if it finds a problem.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blockSchema, navigationSchema, pageSchema, type Block, type Navigation, type PageDefinition } from "../../src/blocks/schema.ts";
import { runValidator } from "./apply.mts";
import { importLocalImage, localizeImagesIn } from "./media.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const pagesDir = path.join(root, "src", "content", "pages");
const navFile = path.join(root, "src", "content", "navigation.json");

export type Change = { file: string; content: string | null };
export type Plan = {
  op: string;
  /** One plain sentence: what will happen. */
  summary: string;
  /** Plain-language before/after lines for the confirmation card. */
  preview: string[];
  changes: Change[];
  /** Page paths whose rendered output changes (what to measure). */
  affectedPaths: string[];
  /** Destructive: the CLI needs --yes to commit. */
  destructive: boolean;
  warnings: string[];
};
export type CommitResult = { ok: boolean; files: string[]; errors: string[]; warnings: string[] };

/* ----------------------------------------------------------------- helpers */

const slugOf = (s: string) => (s === "/" || s === "home" ? "home" : s.replace(/^\//, ""));
const pathOf = (slug: string) => (slug === "home" ? "/" : `/${slug}`);
const pageFile = (slug: string) => path.join(pagesDir, `${slug}.json`);
const json = (v: unknown) => JSON.stringify(v, null, 2) + "\n";
const read = (file: string) => JSON.parse(readFileSync(file, "utf8")) as unknown;

export function listPageSlugs(): string[] {
  return existsSync(pagesDir) ? readdirSync(pagesDir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) : [];
}

export function loadPage(slugArg: string): { slug: string; page: PageDefinition } {
  const slug = slugOf(slugArg);
  const file = pageFile(slug);
  if (!existsSync(file)) throw new Error(`There is no page "${slugArg}". Pages: ${listPageSlugs().join(", ")}.`);
  return { slug, page: pageSchema.parse(read(file)) };
}

export function loadNavigation(): Navigation {
  return navigationSchema.parse(read(navFile));
}

const text = (v: unknown) => (typeof v === "string" ? v : undefined);
/** The words a person would use to recognise a section. */
export const blockName = (b: Block) => {
  const x = b as unknown as Record<string, unknown>;
  return text(x.heading) ?? text(x.eyebrow) ?? text(x.title) ?? text(x.anchor) ?? b.type;
};
const describe = (b: Block, i: number) => `#${i} ${b.type}${blockName(b) !== b.type ? ` “${blockName(b)}”` : ""}`;

/** Find one section: "#3", "type:faq", exact heading, or part of its heading. Fails clearly on none/several. */
export function resolveBlock(page: PageDefinition, needle: string): number {
  const blocks = page.blocks;
  const n = needle.trim().toLowerCase();
  if (/^#\d+$/.test(n)) {
    const i = Number(n.slice(1));
    if (!blocks[i]) throw new Error(`The page has no section ${n}. It has ${blocks.length} (0 to ${blocks.length - 1}).`);
    return i;
  }
  const all = `Sections: ${blocks.map(describe).join(" | ")}`;
  const typed = n.startsWith("type:") ? n.slice(5) : undefined;
  const hits = (fn: (b: Block) => boolean) => blocks.map((b, i) => (fn(b) ? i : -1)).filter((i) => i >= 0);
  const exact = typed ? hits((b) => b.type === typed) : hits((b) => [blockName(b), (b as { anchor?: string }).anchor].some((v) => v && v.toLowerCase() === n));
  const found = exact.length ? exact : typed ? [] : hits((b) => (JSON.stringify([blockName(b), (b as { eyebrow?: string }).eyebrow, (b as { anchor?: string }).anchor]).toLowerCase().includes(n)));
  if (found.length === 1) return found[0];
  if (!found.length) throw new Error(`No section matches “${needle}”. ${all}`);
  throw new Error(`“${needle}” matches ${found.length} sections (${found.map((i) => `#${i}`).join(", ")}). Use #<number> to pick one. ${all}`);
}

/** RFC 7386-style merge: objects merge, arrays and values replace, null deletes. */
function merge(base: unknown, patch: unknown): unknown {
  if (patch === null) return undefined;
  if (Array.isArray(patch) || typeof patch !== "object") return patch;
  const out: Record<string, unknown> = base && typeof base === "object" && !Array.isArray(base) ? { ...(base as Record<string, unknown>) } : {};
  for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
    const r = merge(out[k], v);
    if (r === undefined) delete out[k];
    else out[k] = r;
  }
  return out;
}

const clip = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return s === undefined ? "(nothing)" : s.length > 90 ? `${s.slice(0, 87)}…` : s;
};
/** Changed leaves between two JSON values, as "path: old → new". */
function leafDiff(a: unknown, b: unknown, at = ""): string[] {
  if (JSON.stringify(a) === JSON.stringify(b)) return [];
  const isObj = (v: unknown) => v && typeof v === "object";
  if (isObj(a) && isObj(b) && Array.isArray(a) === Array.isArray(b)) {
    const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
    return [...keys].flatMap((k) => leafDiff((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], at ? `${at}.${k}` : k));
  }
  return [`${at || "(value)"}: ${clip(a)} → ${clip(b)}`];
}

type ImageHit = { path: string; ref: { src: string; alt: string } };
function imagesIn(node: unknown, at = ""): ImageHit[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => imagesIn(n, `${at}[${i}]`));
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    if (typeof o.src === "string" && typeof o.alt === "string") return [{ path: at, ref: o as { src: string; alt: string } }];
    return Object.entries(o).flatMap(([k, v]) => imagesIn(v, at ? `${at}.${k}` : k));
  }
  return [];
}

function hrefsIn(node: unknown, at = ""): { path: string; href: string }[] {
  if (Array.isArray(node)) return node.flatMap((n, i) => hrefsIn(n, `${at}[${i}]`));
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([k, v]) => (k === "href" && typeof v === "string" ? [{ path: at, href: v }] : hrefsIn(v, at ? `${at}.${k}` : k)));
  }
  return [];
}

/* -------------------------------------------------------------------- list */

export function listSite() {
  const pages = listPageSlugs().map((slug) => {
    const page = pageSchema.parse(read(pageFile(slug)));
    return {
      slug,
      path: page.path,
      title: page.seo.title,
      sections: page.blocks.map((b, i) => ({ index: i, type: b.type, name: blockName(b), images: imagesIn(b).length })),
    };
  });
  return { pages, navigation: loadNavigation() };
}

/* -------------------------------------------------------------- operations */

const pageChange = (slug: string, page: PageDefinition): Change => ({ file: pageFile(slug), content: json(page) });
const base = (op: string, p: Partial<Plan> & Pick<Plan, "summary">): Plan => ({ op, preview: [], changes: [], affectedPaths: [], destructive: false, warnings: [], ...p });

export function planMoveSection(a: { page: string; section: string; after?: string; before?: string; to?: "start" | "end" }): Plan {
  const { slug, page } = loadPage(a.page);
  const from = resolveBlock(page, a.section);
  if (page.blocks[from].type === "hero") throw new Error("The hero (top banner) stays at the top of the page and cannot be moved.");
  const moved = page.blocks[from];
  const rest = page.blocks.filter((_, i) => i !== from);
  const restPage = { ...page, blocks: rest };
  let to: number;
  let where: string;
  if (a.after) {
    const t = resolveBlock(restPage, a.after);
    to = t + 1;
    where = `after “${blockName(rest[t])}”`;
  } else if (a.before) {
    const t = resolveBlock(restPage, a.before);
    to = Math.max(1, t);
    where = to === t ? `before “${blockName(rest[t])}”` : "right after the top banner";
  } else if (a.to === "start") {
    to = 1;
    where = "right after the top banner";
  } else if (a.to === "end") {
    to = rest.length;
    where = "at the end of the page";
  } else throw new Error("Say where to move it: after <section>, before <section>, or to start / end.");
  const blocks = [...rest.slice(0, to), moved, ...rest.slice(to)];
  if (blocks.every((b, i) => b === page.blocks[i])) throw new Error("It is already there; nothing to move.");
  return base("move-section", {
    summary: `Move “${blockName(moved)}” ${where} on ${pathOf(slug)}.`,
    preview: [`Before: ${page.blocks.map((b) => blockName(b)).join(" → ")}`, `After:  ${blocks.map((b) => blockName(b)).join(" → ")}`],
    changes: [pageChange(slug, { ...page, blocks })],
    affectedPaths: [pathOf(slug)],
  });
}

export function planRemoveSection(a: { page: string; section: string }): Plan {
  const { slug, page } = loadPage(a.page);
  const i = resolveBlock(page, a.section);
  const gone = page.blocks[i];
  if (gone.type === "hero") throw new Error("The hero (top banner) cannot be removed: every page needs exactly one, it holds the page's main heading.");
  const warnings: string[] = [];
  const anchor = (gone as { anchor?: string }).anchor;
  if (anchor) {
    const users = hrefsIn(page.blocks.filter((_, k) => k !== i)).filter((h) => h.href === `#${anchor}`);
    if (users.length) warnings.push(`${users.length} link(s) on this page jump to this section (#${anchor}); the check below will stop the removal until they are changed.`);
  }
  return base("remove-section", {
    summary: `Remove the “${blockName(gone)}” section (${gone.type}) from ${pathOf(slug)}.`,
    preview: [`Removed: ${describe(gone, i)}`, `Page will have ${page.blocks.length - 1} section(s): ${page.blocks.filter((_, k) => k !== i).map((b) => blockName(b)).join(" → ")}`],
    changes: [pageChange(slug, { ...page, blocks: page.blocks.filter((_, k) => k !== i) })],
    affectedPaths: [pathOf(slug)],
    destructive: true,
    warnings,
  });
}

/** Update fields of one section (patch = fields to change), or of the page itself (seo, reference) when no section is given. */
export async function planUpdate(a: { page: string; section?: string; patch: unknown; log?: (m: string) => void }): Promise<Plan> {
  const { slug, page } = loadPage(a.page);
  if (!a.patch || typeof a.patch !== "object" || Array.isArray(a.patch)) throw new Error("The patch must be a JSON object of the fields to change.");
  if (a.section === undefined) {
    const p = a.patch as Record<string, unknown>;
    const bad = Object.keys(p).filter((k) => !["seo", "reference"].includes(k));
    if (bad.length) throw new Error(`Page-level updates can change only seo and reference (got: ${bad.join(", ")}). To change a section, name it.`);
    const next = merge(page, p) as PageDefinition;
    const parsed = pageSchema.safeParse(next);
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n"));
    return base("update", {
      summary: `Update the page settings of ${pathOf(slug)} (search-engine title/description).`,
      preview: leafDiff(page, parsed.data).map((l) => l),
      changes: [pageChange(slug, parsed.data)],
      affectedPaths: [pathOf(slug)],
    });
  }
  const i = resolveBlock(page, a.section);
  const old = page.blocks[i];
  const patch = a.patch as Record<string, unknown>;
  if ("type" in patch && patch.type !== old.type) throw new Error(`A section's kind cannot change (it is a ${old.type}). Remove it and add a new section instead.`);
  const merged = merge(old, patch);
  const parsed = blockSchema.safeParse(merged);
  if (!parsed.success) throw new Error(`That change is not allowed for a ${old.type} section:\n${parsed.error.issues.map((x) => `  - ${x.path.join(".") || "(root)"}: ${x.message}`).join("\n")}`);
  const next = parsed.data;
  if (JSON.stringify(next) === JSON.stringify(old)) throw new Error("Nothing would change.");
  const localized = await localizeImagesIn(next, a.log);
  const blocks = page.blocks.map((b, k) => (k === i ? next : b));
  return base("update", {
    summary: `Update the “${blockName(old)}” section on ${pathOf(slug)}.`,
    preview: leafDiff(old, next),
    changes: [pageChange(slug, { ...page, blocks })],
    affectedPaths: [pathOf(slug)],
    warnings: localized ? [`${localized} image(s) were copied into the site with neutral file names.`] : [],
  });
}

export async function planReplaceImage(a: { page: string; section: string; file: string; alt: string; which?: string }): Promise<Plan> {
  const { slug, page } = loadPage(a.page);
  const i = resolveBlock(page, a.section);
  const block = structuredClone(page.blocks[i]);
  const imgs = imagesIn(block);
  if (!imgs.length) throw new Error(`The “${blockName(block)}” section has no image to replace. To add one, use an update with an image field.`);
  const list = imgs.map((h, k) => `  ${k}: ${h.path} — “${h.ref.alt}” (${h.ref.src})`).join("\n");
  let target: ImageHit;
  if (a.which === undefined) {
    if (imgs.length > 1) throw new Error(`This section has ${imgs.length} images. Say which one (--which <number> or part of its description):\n${list}`);
    target = imgs[0];
  } else if (/^\d+$/.test(a.which)) {
    target = imgs[Number(a.which)];
    if (!target) throw new Error(`No image ${a.which}. Images:\n${list}`);
  } else {
    const m = imgs.filter((h) => `${h.ref.alt} ${h.ref.src}`.toLowerCase().includes(a.which!.toLowerCase()));
    if (m.length !== 1) throw new Error(`“${a.which}” matches ${m.length} images. Images:\n${list}`);
    target = m[0];
  }
  if (a.alt.trim().length < 3) throw new Error("Describe the new photo in a few words (it is read aloud for people using screen readers and used by search engines).");
  const oldRef = { ...target.ref };
  target.ref.src = await importLocalImage(a.file);
  target.ref.alt = a.alt.trim();
  const blocks = page.blocks.map((b, k) => (k === i ? blockSchema.parse(block) : b));
  return base("replace-image", {
    summary: `Replace the photo in “${blockName(block)}” on ${pathOf(slug)}.`,
    preview: [`Old photo: ${oldRef.src} — “${oldRef.alt}”`, `New photo: ${target.ref.src} — “${target.ref.alt}” (saved with a neutral file name)`],
    changes: [pageChange(slug, { ...page, blocks })],
    affectedPaths: [pathOf(slug)],
  });
}

export function planRemovePage(a: { slug: string }): Plan {
  const { slug, page } = loadPage(a.slug);
  if (slug === "home") throw new Error("The home page cannot be removed.");
  const target = pathOf(slug);
  const nav = loadNavigation();
  const nextNav: Navigation = {
    header: nav.header.filter((n) => n.href !== target),
    footer: nav.footer.map((g) => ({ ...g, links: g.links.filter((l) => l.href !== target) })).filter((g) => g.links.length),
  };
  const inbound: string[] = [];
  for (const other of listPageSlugs().filter((s) => s !== slug)) {
    const p = pageSchema.parse(read(pageFile(other)));
    for (const h of hrefsIn(p.blocks)) if (h.href.split(/[?#]/)[0] === target) inbound.push(`${pathOf(other)} → ${h.path} links to ${h.href}`);
  }
  const navRemoved = nav.header.length - nextNav.header.length + nav.footer.reduce((n, g) => n + g.links.length, 0) - nextNav.footer.reduce((n, g) => n + g.links.length, 0);
  const warnings = inbound.length ? [`Other pages link to ${target}; change or remove those links first, otherwise the check will refuse this:\n${inbound.map((l) => `  - ${l}`).join("\n")}`] : [];
  return base("remove-page", {
    summary: `Remove the page ${target} (“${page.seo.title}”).`,
    preview: [
      `The page ${target} and its ${page.blocks.length} section(s) will be deleted.`,
      `${navRemoved} menu link(s) to it will be removed. It will also drop out of the sitemap and llms.txt (they are built from the pages).`,
      inbound.length ? `${inbound.length} link(s) on other pages still point at it.` : "No other page links to it.",
    ],
    changes: [{ file: pageFile(slug), content: null }, { file: navFile, content: json(nextNav) }],
    affectedPaths: ["/"],
    destructive: true,
    warnings,
  });
}

export type MenuArgs = {
  action: "add" | "rename" | "remove" | "move";
  area: "header" | "footer";
  /** footer only: the column title, e.g. Company */
  group?: string;
  label: string;
  href?: string;
  newLabel?: string;
  /** 1-based position */
  position?: number;
};

export function planMenu(a: MenuArgs): Plan {
  // Git Bash on Windows rewrites an argument like /services into C:/Program Files/Git/services; undo that.
  if (a.href) a = { ...a, href: a.href.replace(/^[A-Za-z]:[\\/]Program Files[\\/]Git(?=[\\/])/, "") };
  const nav = structuredClone(loadNavigation());
  let list: { label: string; href: string }[];
  let where = a.area === "header" ? "the top menu" : `the footer`;
  if (a.area === "header") list = nav.header;
  else {
    if (!a.group) throw new Error(`The footer has columns: ${nav.footer.map((g) => g.title).join(", ")}. Say which one.`);
    let g = nav.footer.find((x) => x.title.toLowerCase() === a.group!.toLowerCase());
    if (!g) {
      if (a.action !== "add") throw new Error(`No footer column “${a.group}”. Columns: ${nav.footer.map((x) => x.title).join(", ")}.`);
      g = { title: a.group, links: [] };
      nav.footer.push(g);
    }
    list = g.links;
    where = `the footer column “${g.title}”`;
  }
  const before = list.map((l) => l.label).join(" · ") || "(empty)";
  const idx = list.findIndex((l) => l.label.toLowerCase() === a.label.toLowerCase());
  const at = (p: number | undefined, len: number) => (p === undefined ? len : Math.max(0, Math.min(len, p - 1)));
  let summary: string;
  if (a.action === "add") {
    if (!a.href) throw new Error("Which page or link should it open? (e.g. /services)");
    if (idx >= 0) throw new Error(`“${a.label}” is already in ${where}.`);
    list.splice(at(a.position, list.length), 0, { label: a.label, href: a.href });
    summary = `Add “${a.label}” (${a.href}) to ${where}.`;
  } else {
    if (idx < 0) throw new Error(`There is no “${a.label}” in ${where}. It has: ${before}.`);
    if (a.action === "remove") {
      list.splice(idx, 1);
      summary = `Remove “${a.label}” from ${where}.`;
    } else if (a.action === "rename") {
      if (!a.newLabel && !a.href) throw new Error("Give the new name and/or the new link.");
      if (a.newLabel) list[idx].label = a.newLabel;
      if (a.href) list[idx].href = a.href;
      summary = `Change “${a.label}” in ${where}${a.newLabel ? ` to “${a.newLabel}”` : ""}${a.href ? ` (opens ${a.href})` : ""}.`;
    } else {
      if (a.position === undefined) throw new Error("Say the new position (1 = first).");
      const [it] = list.splice(idx, 1);
      list.splice(at(a.position, list.length), 0, it);
      summary = `Move “${a.label}” to position ${a.position} in ${where}.`;
    }
  }
  const cleaned: Navigation = { header: nav.header, footer: nav.footer.filter((g) => g.links.length) };
  const after = (a.area === "header" ? cleaned.header : (cleaned.footer.find((g) => g.title.toLowerCase() === a.group!.toLowerCase())?.links ?? [])).map((l) => l.label).join(" · ") || "(empty)";
  return base("menu", {
    summary,
    preview: [`Before: ${before}`, `After:  ${after}`],
    changes: [{ file: navFile, content: json(cleaned) }],
    affectedPaths: ["/"],
    destructive: a.action === "remove",
  });
}

/* ------------------------------------------------------------------ commit */

/** Write the plan, validate the whole site, undo everything if the validator objects. */
export function commitPlan(plan: Plan): CommitResult {
  const before = plan.changes.map((c) => ({ file: c.file, content: existsSync(c.file) ? readFileSync(c.file, "utf8") : null }));
  for (const c of plan.changes) {
    if (c.content === null) rmSync(c.file, { force: true });
    else {
      mkdirSync(path.dirname(c.file), { recursive: true });
      writeFileSync(c.file, c.content);
    }
  }
  const v = runValidator();
  if (v.errors.length) {
    for (const b of before.reverse()) (b.content === null ? rmSync(b.file, { force: true }) : writeFileSync(b.file, b.content));
    return { ok: false, files: [], errors: v.errors, warnings: v.warnings };
  }
  return { ok: true, files: plan.changes.map((c) => path.relative(root, c.file).replace(/\\/g, "/")), errors: [], warnings: v.warnings };
}
