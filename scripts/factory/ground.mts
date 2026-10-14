/**
 * Grounding check: every piece of text in a generated page/section must be traceable to the content bundle.
 *
 * - Numbers are strict: a digit sequence that is not present in the sources is always flagged (catches invented stats).
 * - Short strings (labels, headings): every meaningful word must appear somewhere in the sources.
 * - Longer strings: >= 60% of the words must come from ONE source paragraph/bullet/heading, or >= 85% overall.
 * Generic UI labels ("Learn more", "Contact us", ...) are allowed. Results are advisory (reported for human review);
 * use --strict-grounding to make flagged text a hard failure.
 */
import type { ContentBundle } from "./content.mts";

export type Ungrounded = { path: string; text: string; overlap: number; reason: string };
export type GroundingResult = { checked: number; grounded: number; ungrounded: Ungrounded[] };

const STOP = new Set("a an and are as at be by for from has have in into is it its of on or our that the their them they this to was we were will with you your us can how why what when who which not no than then so such these those there here also more most other new".split(" "));
const ALLOWED_LABELS = [
  "learn more", "read more", "see more", "see all", "view all", "show more", "show all", "view details", "explore", "get in touch", "contact us",
  "speak with us", "talk to us", "start a project", "apply now", "browse all openings", "see our work", "read case study", "back to home",
];
// Keys whose string values are not prose (structure, URLs, enums).
const SKIP_KEYS = new Set(["type", "variant", "href", "src", "alt", "id", "anchor", "icon", "style", "arrow", "bg", "tone", "layout", "columns", "side", "align", "size", "schemaType", "path", "url", "applyLabel"]);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]s\b/g, "")
    .replace(/[^a-z0-9%+.\s-]/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^[-.]+|[-.]+$/g, ""))
    .filter((w) => w.length > 1 && !STOP.has(w));
const numbers = (s: string) => (s.match(/\d[\d,.]*\d|\d/g) ?? []).map((n) => n.replace(/[,]/g, ""));

export function checkGrounding(generated: unknown, bundle: ContentBundle): GroundingResult {
  const units: string[][] = [];
  for (const s of bundle.sections) {
    for (const t of [s.heading, ...s.paragraphs, ...s.bullets, ...s.links.map((l) => l.label)]) if (t) units.push(words(t));
  }
  const corpus = new Set(units.flat());
  const corpusNumbers = new Set(bundle.sections.flatMap((s) => [s.heading ?? "", ...s.paragraphs, ...s.bullets]).flatMap(numbers));

  const strings: { path: string; text: string }[] = [];
  const visit = (node: unknown, p: string, parentKey = "", parent?: Record<string, unknown>) => {
    if (typeof node === "string") {
      // CTA button labels are UI copy, not claims.
      if (parentKey === "label" && parent && "href" in parent) return;
      strings.push({ path: p, text: node });
    } else if (Array.isArray(node)) node.forEach((n, i) => visit(n, `${p}[${i}]`, parentKey, parent));
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        if (SKIP_KEYS.has(k)) continue;
        visit(v, p ? `${p}.${k}` : k, k, node as Record<string, unknown>);
      }
    }
  };
  visit(generated, "");

  const ungrounded: Ungrounded[] = [];
  let checked = 0;
  for (const { path, text } of strings) {
    const trimmed = text.trim();
    if (!trimmed) continue;
    if (ALLOWED_LABELS.includes(trimmed.toLowerCase().replace(/[.!→↓\s]+$/g, ""))) continue;
    checked++;
    const missingNumbers = numbers(trimmed).filter((n) => !corpusNumbers.has(n));
    if (missingNumbers.length) {
      ungrounded.push({ path, text: trimmed, overlap: 0, reason: `number(s) not in the sources: ${missingNumbers.join(", ")}` });
      continue;
    }
    const w = words(trimmed);
    if (!w.length) continue;
    const overall = w.filter((x) => corpus.has(x)).length / w.length;
    if (w.length <= 3) {
      if (overall < 1) ungrounded.push({ path, text: trimmed, overlap: overall, reason: "label/heading words not found in the sources" });
      continue;
    }
    const set = new Set(w);
    const bestUnit = Math.max(0, ...units.map((u) => [...set].filter((x) => u.includes(x)).length / set.size));
    const best = Math.max(bestUnit >= 0.6 ? bestUnit : 0, overall >= 0.85 ? overall : 0);
    if (best === 0) ungrounded.push({ path, text: trimmed, overlap: Math.max(bestUnit, overall), reason: `only ${Math.round(Math.max(bestUnit, overall) * 100)}% of the words trace to the sources` });
  }
  ungrounded.sort((a, b) => a.overlap - b.overlap);
  return { checked, grounded: checked - ungrounded.length, ungrounded };
}

export function groundingReport(r: GroundingResult): string {
  const pct = r.checked ? Math.round((r.grounded / r.checked) * 100) : 100;
  const lines = [`Grounding: ${r.grounded}/${r.checked} text items (${pct}%) trace to the supplied content.`];
  if (r.ungrounded.length) {
    lines.push("Needs a human look (not found in the sources):");
    for (const u of r.ungrounded.slice(0, 25)) lines.push(`  - ${u.path}: "${u.text.slice(0, 110)}"  [${u.reason}]`);
    if (r.ungrounded.length > 25) lines.push(`  ... and ${r.ungrounded.length - 25} more`);
  }
  return lines.join("\n");
}
