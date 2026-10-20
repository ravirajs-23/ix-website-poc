/**
 * PAGE FACTORY — one command to create a page, or add a section, from a reference URL + your content.
 *
 *   npm run factory -- run [--brief brief.json]     THE FULL SEQUENCE: asks the questions (or reads the brief), measures the
 *                                                   site, builds the page/section, measures again, writes the before/after
 *                                                   SEO report and posts it on the pull request. Saves progress after each step.
 *   npm run factory -- resume --run <run folder>    continue a paused/failed run (e.g. after draft.json was written)
 *   npm run factory -- report --run <run folder>    re-render report.md from the saved measurements (no re-measuring)
 *   npm run factory -- publish --run <run folder>   (re)post a run's report as a pull-request comment [--pr N]
 *   flags for run/resume: --engine api|prompt  --headed  --no-measure  --skip-baseline  --strict-grounding  --pr N
 *
 *   Single stages and the older direct commands:
 *   npm run factory -- page    --reference <url> --slug services --title "Services" \
 *                              --content live:https://incubxperts.com/services/ai-adoption-and-strategy \
 *                              [--content strapi:case-stories?limit=3] [--content file:notes.md] [--nav "Services"]
 *
 *   npm run factory -- section --page careers --reference <url> --ref-section "How we work" \
 *                              --content file:values.md [--after "Why join" | --before "Perks" | --at start|end | --index 3]
 *
 *   npm run factory -- apply   --run .factory/runs/<run>        apply a draft.json you (or Claude Code) wrote
 *   npm run factory -- capture <url> | content <spec>...         run a single stage
 *
 *   Changing what is already there (no reference page needed; checked, undone if invalid, measured before/after):
 *   npm run factory -- ship --title "Add Our Values page" [--run <run folder>] [--no-pr]   branch + commit + push to both remotes + pull request
 *   npm run factory -- shots --path /careers [--out dir] [--rebuild]      desktop + phone screenshots of a built page
 *   npm run factory -- edit list                                    pages, sections, images and menus
 *   npm run factory -- edit move-section   --page about --section "Our values" (--after X | --before X | --to start|end)
 *   npm run factory -- edit remove-section --page about --section "Our values" --yes
 *   npm run factory -- edit update         --page about [--section "Our values"] --patch changes.json
 *   npm run factory -- edit replace-image  --page about --section "Our story" --image photo.jpg --alt "Team at an offsite" [--which N]
 *   npm run factory -- edit remove-page    --slug old-page --yes
 *   npm run factory -- edit menu add|rename|remove|move --area header|footer [--group Company] --label X [--href /x] [--new-label Y] [--position N]
 *   edit flags: --dry-run (preview only)  --no-measure  --runs 3  --port 3199
 *
 * Engines:  --engine api     fully automatic (needs ANTHROPIC_API_KEY; model via FACTORY_MODEL / --model)
 *           --engine prompt  (default when no key) writes a prompt pack; Claude Code answers it (see the skills)
 * Other flags: --headed (visible Chrome for sites that block headless) --force --strict-grounding --retries 2
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pageSchema, type PageDefinition } from "../../src/blocks/schema.ts";
import { applyDraft, resolveInsertIndex, type InsertSpec, type RunMeta } from "./apply.mts";
import { capture, ReferenceBlockedError, type ReferenceCapture } from "./capture.mts";
import { loadContent, type ContentBundle } from "./content.mts";
import { buildPromptPack, callApi, DEFAULT_MODEL, writePromptPack, type Target } from "./generate.mts";
import { listSite, planMenu, planMoveSection, planRemovePage, planRemoveSection, planReplaceImage, planUpdate, type MenuArgs, type Plan } from "./edit.mts";
import { runEdit } from "./editrun.mts";
import { ship } from "./ship.mts";
import { takeShots } from "./shots.mts";
import { groundingReport } from "./ground.mts";
import { publishRun, regenerateReport, runPipeline, type Flags } from "./pipeline.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// Tiny .env.local loader (no dependency); real environment variables win.
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (!existsSync(p)) continue;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = new Map<string, string[]>();
for (let i = 1; i < argv.length; i++) {
  if (!argv[i].startsWith("--")) continue;
  const k = argv[i].slice(2);
  const next = argv[i + 1];
  const val = next !== undefined && !next.startsWith("--") ? (i++, next) : "true";
  flags.set(k, [...(flags.get(k) ?? []), val]);
}
// Git Bash on Windows rewrites an argument like /careers into "C:/Program Files/Git/careers"; undo that.
const unmsys = (v: string) => v.replace(/^[A-Za-z]:[\/]Program Files[\/]Git(?=[\/])/, "");
const flag = (k: string) => {
  const v = flags.get(k)?.[flags.get(k)!.length - 1];
  return v === undefined ? v : unmsys(v);
};
const flagAll = (k: string) => (flags.get(k) ?? []).map(unmsys);
const has = (k: string) => flags.has(k);
const log = (m: string) => console.log(`  ${m}`);

function die(msg: string, code = 1): never {
  console.error(`\n${msg}`);
  process.exitCode = code;
  throw new Error("__factory_exit__");
}

const slugOk = (s?: string) => !!s && /^[a-z][a-z0-9-]*$/.test(s);
const stamp = () => new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);

function loadPage(slug: string): PageDefinition {
  const file = path.join(root, "src", "content", "pages", `${slug}.json`);
  if (!existsSync(file)) die(`No page "${slug}" (expected ${path.relative(root, file)}).`);
  return pageSchema.parse(JSON.parse(readFileSync(file, "utf8")));
}

function printResult(res: Awaited<ReturnType<typeof applyDraft>>, runDir: string, meta: RunMeta) {
  const report = [
    `# Page factory report`,
    ``,
    `- Mode: ${meta.mode}${meta.mode === "page" ? ` (/${meta.slug})` : ` (page: ${meta.pageSlug})`}`,
    `- Reference: ${meta.referenceUrl}${meta.refSection ? ` — section "${meta.refSection}"` : ""}`,
    `- Content: ${meta.contentSpecs.join(", ")}`,
    `- Result: ${res.ok ? "applied — " + res.summary : "NOT applied — " + res.summary}`,
    `- Files: ${res.files.join(", ") || "(none)"}`,
    ``,
    groundingReport(res.grounding),
    res.errors.length ? `\nErrors:\n${res.errors.map((e) => `- ${e}`).join("\n")}` : "",
    res.warnings.length ? `\nWarnings:\n${res.warnings.map((e) => `- ${e}`).join("\n")}` : "",
    ``,
  ].join("\n");
  writeFileSync(path.join(runDir, "report.md"), report);
  console.log("\n" + report);
  console.log(`Run folder: ${path.relative(root, runDir)}`);
  if (res.ok) console.log(`\nNext: npm run build   (then review, commit on a branch)`);
}

async function createRun(meta: RunMeta, opts: { headed: boolean }) {
  const runDir = path.join(root, ".factory", "runs", `${stamp()}-${meta.slug ?? meta.pageSlug}`);
  mkdirSync(runDir, { recursive: true });
  writeFileSync(path.join(runDir, "run.json"), JSON.stringify(meta, null, 2) + "\n");

  console.log("\n[1/4] Capturing the reference");
  const reference = await capture(meta.referenceUrl, path.join(runDir, "reference"), { headed: opts.headed, log });
  console.log("[2/4] Reading content");
  const content = await loadContent(meta.contentSpecs, { headed: opts.headed, log });
  writeFileSync(path.join(runDir, "content.json"), JSON.stringify(content, null, 2) + "\n");
  return { runDir, reference, content };
}

function targetFor(meta: RunMeta): Target {
  if (meta.mode === "page") return { mode: "page", slug: meta.slug!, title: meta.title! };
  const page = loadPage(meta.pageSlug!);
  return { mode: "section", pageSlug: meta.pageSlug!, page, insertDescription: resolveInsertIndex(page, meta.insert).description };
}

async function generateAndApply(meta: RunMeta, runDir: string, reference: ReferenceCapture, content: ContentBundle) {
  const target = targetFor(meta);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  const engine = flag("engine") ?? (hasKey ? "api" : "prompt");
  const refDir = path.join(runDir, "reference");
  const pack = buildPromptPack({ target, reference, referenceDir: refDir, refSectionMatch: meta.refSection, content });

  if (engine === "prompt") {
    writePromptPack(pack, runDir, target);
    console.log("[3/4] Prompt pack written (engine: prompt)");
    console.log(`\n  ${path.relative(root, path.join(runDir, "prompt.md"))}\n  ${path.relative(root, path.join(runDir, "output.schema.json"))}`);
    console.log(`\nNext: have Claude Code answer prompt.md (use the /${meta.mode === "page" ? "new-page" : "add-section"} skill with --run), save draft.json in the run folder, then:\n  npm run factory -- apply --run ${path.relative(root, runDir)}`);
    return;
  }

  const retries = Number(flag("retries") ?? 2);
  let current = pack;
  let lastDraft: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    console.log(`[3/4] Generating (engine: api, attempt ${attempt + 1}/${retries + 1})`);
    const { output, usage } = await callApi(current, { model: flag("model") ?? DEFAULT_MODEL, log });
    log(`tokens: ${usage.input} in / ${usage.output} out`);
    lastDraft = output;
    writeFileSync(path.join(runDir, "draft.json"), JSON.stringify(output, null, 2) + "\n");
    console.log("[4/4] Validating and applying");
    const res = await applyDraft({ meta, draft: output, content, runDir, force: has("force"), strictGrounding: has("strict-grounding"), log });
    if (res.ok || attempt === retries) return printResult(res, runDir, meta);
    log(`validation failed (${res.errors.length} issue(s)); asking the model to fix them`);
    current = buildPromptPack({ target, reference, referenceDir: refDir, refSectionMatch: meta.refSection, content, retry: { previousDraft: lastDraft, errors: res.errors } });
  }
}

async function main() {
  if (cmd === "capture") {
    const url = argv.find((a) => /^https?:/.test(a));
    if (!url) die("Usage: npm run factory -- capture <url> [--out dir] [--headed]");
    const out = flag("out") ?? path.join(".factory", "capture");
    const res = await capture(url, out, { headed: has("headed"), log });
    console.log(`captured ${res.sections.length} sections -> ${out}/reference.json`);
    return;
  }
  if (cmd === "content") {
    const specs = argv.slice(1).filter((a) => !a.startsWith("--") && argv[argv.indexOf(a) - 1] !== "--out");
    const bundle = await loadContent(specs, { headed: has("headed"), log });
    const out = flag("out");
    if (out) writeFileSync(out, JSON.stringify(bundle, null, 2) + "\n");
    for (const s of bundle.sections) console.log(`- ${(s.heading ?? "(no heading)").slice(0, 60)}  paras=${s.paragraphs.length} bullets=${s.bullets.length} images=${s.images.length}`);
    return;
  }
  if (cmd === "apply") {
    const run = flag("run");
    if (!run) die("Usage: npm run factory -- apply --run <run folder> [--draft file] [--force] [--strict-grounding]");
    const runDir = path.resolve(root, run);
    const meta = JSON.parse(readFileSync(path.join(runDir, "run.json"), "utf8")) as RunMeta;
    const content = JSON.parse(readFileSync(path.join(runDir, "content.json"), "utf8")) as ContentBundle;
    const draftFile = path.resolve(root, flag("draft") ?? path.join(run, "draft.json"));
    if (!existsSync(draftFile)) die(`No draft at ${draftFile}. Write the model's answer there first (see prompt.md).`);
    const draft = JSON.parse(readFileSync(draftFile, "utf8"));
    const res = await applyDraft({ meta, draft, content, runDir, force: has("force"), strictGrounding: has("strict-grounding"), log });
    printResult(res, runDir, meta);
    if (!res.ok) process.exitCode = 3;
    return;
  }
  if (cmd === "run" || cmd === "resume") {
    // The whole ordered pipeline: intake -> baseline -> capture -> content -> generate -> apply -> after -> report -> publish
    const flagsObj: Flags = {
      engine: flag("engine"),
      model: flag("model"),
      headed: has("headed") || undefined,
      force: has("force"),
      strictGrounding: has("strict-grounding"),
      retries: flag("retries") !== undefined ? Number(flag("retries")) : undefined,
      skipBaseline: has("skip-baseline"),
      noMeasure: has("no-measure"),
      pr: flag("pr") !== undefined ? Number(flag("pr")) : undefined,
    };
    if (cmd === "resume" && !flag("run")) die("Usage: npm run factory -- resume --run <run folder>");
    process.exitCode = await runPipeline({ runDir: cmd === "resume" ? flag("run") : undefined, briefFile: flag("brief"), flags: flagsObj });
    return;
  }
  if (cmd === "report") {
    if (!flag("run")) die("Usage: npm run factory -- report --run <run folder>   (re-renders report.md from the saved measurements)");
    console.log(`report written: ${regenerateReport(flag("run")!)}`);
    return;
  }
  if (cmd === "publish") {
    if (!flag("run")) die("Usage: npm run factory -- publish --run <run folder> [--pr <number>]");
    process.exitCode = publishRun(flag("run")!, flag("pr") !== undefined ? Number(flag("pr")) : undefined);
    return;
  }
  if (cmd === "ship") {
    const title = flag("title");
    if (!title || title === "true") die('Usage: npm run factory -- ship --title "Add Our Values page" [--run .factory/runs/<run>] [--branch name] [--no-pr]');
    const r = ship({ title, run: flag("run"), branch: flag("branch"), noPr: has("no-pr"), dryRun: has("dry-run"), log });
    console.log(`
${r.message}`);
    if (r.prUrl) console.log(`Pull request: ${r.prUrl}`);
    if (r.skipped.length) console.log(`Not sent to: ${r.skipped.join("; ")}`);
    process.exitCode = r.ok ? 0 : 1;
    return;
  }
  if (cmd === "shots") {
    const p = flag("path");
    if (!p) die("Usage: npm run factory -- shots --path /careers [--out .factory/shots] [--rebuild]");
    const files = await takeShots({ pagePath: p, outDir: flag("out") ?? path.join(".factory", "shots"), rebuild: has("rebuild"), log });
    for (const f of files) console.log(f);
    return;
  }
  if (cmd === "edit") {
    const op = argv[1];
    const need = (k: string, why = `--${k} is required.`) => flag(k) ?? die(why);
    if (op === "list") {
      const site = listSite();
      for (const p of site.pages) {
        console.log(`
${p.path}  (${p.slug}.json)  “${p.title}”`);
        for (const s of p.sections) console.log(`  #${s.index} ${s.type} — ${s.name}${s.images ? `  [${s.images} image(s)]` : ""}`);
      }
      console.log(`
Top menu:  ${site.navigation.header.map((n) => `${n.label} (${n.href})`).join(" · ")}`);
      for (const g of site.navigation.footer) console.log(`Footer / ${g.title}:  ${g.links.map((n) => `${n.label} (${n.href})`).join(" · ")}`);
      return;
    }
    let plan: Plan;
    if (op === "move-section") plan = planMoveSection({ page: need("page"), section: need("section"), after: flag("after"), before: flag("before"), to: flag("to") as "start" | "end" | undefined });
    else if (op === "remove-section") plan = planRemoveSection({ page: need("page"), section: need("section") });
    else if (op === "update") {
      const patchFile = path.resolve(root, need("patch", "--patch <file.json> is required (a JSON file with just the fields to change)."));
      if (!existsSync(patchFile)) die(`Patch file not found: ${patchFile}`);
      plan = await planUpdate({ page: need("page"), section: flag("section"), patch: JSON.parse(readFileSync(patchFile, "utf8")), log });
    } else if (op === "replace-image") plan = await planReplaceImage({ page: need("page"), section: need("section"), file: need("image", "--image <file> is required."), alt: need("alt", "--alt \"short description of the photo\" is required."), which: flag("which") });
    else if (op === "remove-page") plan = planRemovePage({ slug: need("slug") });
    else if (op === "menu") {
      const action = argv[2] as MenuArgs["action"];
      if (!["add", "rename", "remove", "move"].includes(action)) die("Usage: edit menu add|rename|remove|move --area header|footer --label <name> ...");
      const area = need("area") as MenuArgs["area"];
      if (area !== "header" && area !== "footer") die('--area must be "header" or "footer".');
      plan = planMenu({ action, area, group: flag("group"), label: need("label"), href: flag("href"), newLabel: flag("new-label"), position: flag("position") !== undefined ? Number(flag("position")) : undefined });
    } else die("Usage: npm run factory -- edit list | move-section | remove-section | update | replace-image | remove-page | menu   (see --help)");
    process.exitCode = await runEdit(plan, { measure: !has("no-measure"), yes: has("yes"), dryRun: has("dry-run"), runs: Number(flag("runs") ?? 3), port: Number(flag("port") ?? 3199) });
    return;
  }
  if (cmd === "page" || cmd === "section") {
    const referenceUrl = flag("reference");
    const contentSpecs = flagAll("content");
    if (!referenceUrl || !/^https?:/.test(referenceUrl)) die(`--reference <url> is required.`);
    if (!contentSpecs.length) die(`--content is required (live:<url>, strapi:<collection>, file:<path>). Repeat it to combine sources.`);
    const insert: InsertSpec = {
      after: flag("after"),
      before: flag("before"),
      at: flag("at") as "start" | "end" | undefined,
      index: flag("index") !== undefined ? Number(flag("index")) : undefined,
    };
    let meta: RunMeta;
    if (cmd === "page") {
      const slug = flag("slug");
      const title = flag("title");
      if (!slugOk(slug) || !title) die(`--slug (lowercase-with-hyphens) and --title are required for a new page.`);
      if (existsSync(path.join(root, "src", "content", "pages", `${slug}.json`)) && !has("force")) die(`Page "${slug}" already exists. Use --force to replace it, or pick another slug.`);
      meta = { mode: "page", slug, title, referenceUrl, contentSpecs, nav: flag("nav"), createdAt: new Date().toISOString() };
    } else {
      const pageSlug = flag("page");
      if (!slugOk(pageSlug) && pageSlug !== "home") die(`--page <slug> is required for a section (e.g. careers).`);
      loadPage(pageSlug!); // fail early if it does not exist
      meta = { mode: "section", pageSlug, referenceUrl, refSection: flag("ref-section"), contentSpecs, insert, createdAt: new Date().toISOString() };
    }
    try {
      const { runDir, reference, content } = await createRun(meta, { headed: has("headed") });
      await generateAndApply(meta, runDir, reference, content);
    } catch (e) {
      if (e instanceof ReferenceBlockedError) die((e as Error).message, 2);
      throw e;
    }
    return;
  }
  console.log(readFileSync(fileURLToPath(import.meta.url), "utf8").split("*/")[0].replace(/^\/\*\*\r?\n/, "").replace(/^ \* ?/gm, "").trim());
}

main().catch((e) => {
  const issues = (e as { issues?: { path: (string | number)[]; message: string }[] }).issues;
  if ((e as Error).name === "ZodError" && Array.isArray(issues)) {
    console.error("\nThe brief is not valid:");
    for (const i of issues) console.error(`  - ${i.path.join(".") || "(root)"}: ${i.message}`);
    process.exitCode = 1;
    return;
  }
  if ((e as Error).message !== "__factory_exit__") {
    console.error(`\n${(e as Error).message}`);
    process.exitCode = process.exitCode || 1;
  }
});
