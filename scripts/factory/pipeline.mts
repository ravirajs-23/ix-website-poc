/**
 * PIPELINE — the whole factory as one ordered, resumable sequence.
 *
 *   1 intake    questions -> brief.json                       (interactive, or --brief file)
 *   2 baseline  build + measure the site as it is now          (before)
 *   3 capture   reference URL -> structure + screenshots
 *   4 content   live | strapi | file | typed text + images
 *   5 generate  page/section JSON   (engine api: automatic; engine prompt: PAUSES for Claude Code)
 *   6 apply     validate, grounding check, write (rolled back on failure)
 *   7 after     build + measure again
 *   8 report    before/after SEO + performance report (report.md)
 *   9 publish   post the report as a pull-request comment
 *
 * State is saved after every step (state.json), so a paused or failed run resumes where it stopped:
 *   npm run factory -- resume --run .factory/runs/<run>
 * Exit codes: 0 done · 10 waiting for draft.json (engine prompt) · 3 draft rejected · 1 error · 2 reference blocked
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { pageSchema } from "../../src/blocks/schema.ts";
import { applyDraft, resolveInsertIndex, type RunMeta } from "./apply.mts";
import { capture, ReferenceBlockedError, type ReferenceCapture } from "./capture.mts";
import { loadContent, type ContentBundle } from "./content.mts";
import { buildPromptPack, callApi, DEFAULT_MODEL, writePromptPack, type Target } from "./generate.mts";
import { importLocalImage } from "./media.mts";
import { measurePage, measureSite } from "./measure.mts";
import { renderReport, type ReportInput, type Snapshot } from "./report.mts";
import { buildSite, startServer } from "./serve.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const slugRe = /^[a-z][a-z0-9-]*$/;

/* ------------------------------------------------------------------ brief */

export const briefSchema = z.strictObject({
  mode: z.enum(["page", "section"]),
  /** page mode */
  slug: z.string().regex(slugRe).optional(),
  title: z.string().optional(),
  nav: z.string().optional(),
  /** section mode */
  page: z.string().regex(slugRe).optional(),
  insert: z.strictObject({ after: z.string().optional(), before: z.string().optional(), at: z.enum(["start", "end"]).optional(), index: z.number().int().optional() }).optional(),
  reference: z.strictObject({ url: z.string().url(), section: z.string().optional(), headed: z.boolean().optional() }),
  content: z.array(z.string()).min(1),
  images: z
    .strictObject({
      /** content: use images found in the content; files: use only the files below; none: no images */
      mode: z.enum(["content", "files", "none"]).default("content"),
      files: z.array(z.strictObject({ path: z.string(), alt: z.string().min(3) })).optional(),
    })
    .optional(),
  notes: z.string().optional(),
  measure: z.strictObject({ enabled: z.boolean().default(true), runs: z.number().int().min(1).max(5).default(3), port: z.number().int().default(3199) }).optional(),
  publish: z.strictObject({ prComment: z.boolean().default(false), pr: z.number().int().optional() }).optional(),
});
export type Brief = z.infer<typeof briefSchema>;

export type Flags = { engine?: string; model?: string; headed?: boolean; force?: boolean; strictGrounding?: boolean; retries?: number; skipBaseline?: boolean; noMeasure?: boolean; pr?: number; yes?: boolean };

/* ------------------------------------------------------------------ state */

const STEPS = ["intake", "baseline", "capture", "content", "generate", "apply", "after", "report", "publish"] as const;
type StepId = (typeof STEPS)[number];
const TITLES: Record<StepId, string> = {
  intake: "Intake",
  baseline: "Baseline: build and measure the site as it is now",
  capture: "Capture the reference page",
  content: "Read the content and images",
  generate: "Generate the page / section",
  apply: "Validate and apply",
  after: "Build and measure again",
  report: "Write the before/after report",
  publish: "Post the report on the pull request",
};
type StepState = { status: "done" | "waiting" | "skipped"; at: string; note?: string };
type State = { startedAt: string; steps: Partial<Record<StepId, StepState>> };

const log = (m: string) => console.log(`    ${m}`);
const stamp = () => new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const readJson = <T,>(file: string): T => JSON.parse(readFileSync(file, "utf8")) as T;
const writeJson = (file: string, v: unknown) => writeFileSync(file, JSON.stringify(v, null, 2) + "\n");

class Pause extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

/* ----------------------------------------------------------------- intake */

function listPages(): string[] {
  const dir = path.join(root, "src", "content", "pages");
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, "")) : [];
}

export async function interactiveIntake(runDir: string): Promise<Brief> {
  // Read lines through a buffered async iterator: answers that arrive all at once (piped or pasted input)
  // are queued instead of being lost between questions, and running out of input is a clear error.
  const rl = readline.createInterface({ input: process.stdin });
  const lines = rl[Symbol.asyncIterator]();
  const readLine = async (prompt: string): Promise<string> => {
    process.stdout.write(prompt);
    const { value, done } = await lines.next();
    if (done) throw new Error("The input ended before all the questions were answered. Run it again, or use --brief <file> to skip the questions.");
    if (!process.stdin.isTTY) process.stdout.write(`${value}\n`); // echo piped answers so the log reads like a session
    return value as string;
  };
  const ask = async (q: string, def?: string) => {
    const a = (await readLine(`  ${q}${def ? ` [${def}]` : ""}: `)).trim();
    return a || def || "";
  };
  try {
    console.log("\n  Let's set this up. Press Enter to accept a [default].\n");
    const mode = ((await ask("Create a whole new PAGE, or add a SECTION to an existing page? (page/section)", "section")).toLowerCase().startsWith("p") ? "page" : "section") as "page" | "section";
    const brief: Record<string, unknown> = { mode };
    if (mode === "page") {
      const slug = await ask("URL slug for the new page, e.g. services (becomes /services)");
      if (!slugRe.test(slug)) throw new Error("slug must be lowercase letters, digits and hyphens");
      brief.slug = slug;
      brief.title = await ask("Page title", slug.charAt(0).toUpperCase() + slug.slice(1));
      const nav = await ask("Header navigation label (blank = not in the nav)");
      if (nav) brief.nav = nav;
    } else {
      const pages = listPages();
      console.log(`  Existing pages: ${pages.join(", ")}`);
      const page = await ask("Which page gets the new section?");
      if (!pages.includes(page)) throw new Error(`no page "${page}"`);
      brief.page = page;
      const pj = pageSchema.parse(readJson(path.join(root, "src", "content", "pages", `${page}.json`)));
      console.log("  Sections on that page:");
      pj.blocks.forEach((b, i) => console.log(`    ${i}. ${b.type}${(b as { heading?: string }).heading ? ` — ${(b as { heading?: string }).heading}` : ""}`));
      const where = await ask("Insert AFTER which section? (number or heading text; blank = before the closing call-to-action)");
      if (where) brief.insert = /^\d+$/.test(where) ? { after: pj.blocks[Number(where)] ? (((pj.blocks[Number(where)] as { heading?: string }).heading) ?? `type:${pj.blocks[Number(where)].type}`) : where } : { after: where };
    }
    const refUrl = await ask("Reference URL (the page whose LAYOUT to follow)");
    const refSection = mode === "section" ? await ask("Which section of that page? (its heading, e.g. How we work)") : "";
    brief.reference = { url: refUrl, ...(refSection ? { section: refSection } : {}) };

    const content: string[] = [];
    console.log("\n  Content sources (where the words come from). Add as many as you like:");
    console.log("    live:<url>[#Heading]   text from a live page, e.g. live:https://incubxperts.com/about-us#Leadership");
    console.log("    strapi:<collection>    entries from Strapi (needs FACTORY_STRAPI_URL + FACTORY_STRAPI_TOKEN), e.g. strapi:testimonials?limit=3");
    console.log("    file:<path>            a .md / .txt / .json file");
    console.log("    text                   type or paste it now");
    for (;;) {
      const c = await ask("Add a content source (blank to finish)");
      if (!c) break;
      if (c === "text") {
        console.log("  Type or paste the content (Markdown is fine). Finish with a line containing only END:");
        const lines: string[] = [];
        for (;;) {
          const l = await readLine("  > ");
          if (l.trim() === "END") break;
          lines.push(l);
        }
        const f = path.join(runDir, `typed-content-${content.length + 1}.md`);
        writeFileSync(f, lines.join("\n") + "\n");
        content.push(`file:${f}`);
      } else content.push(c);
    }
    brief.content = content;

    const imgMode = (await ask("Images: use the ones found in the content, use your own files, or none? (content/files/none)", "content")) as "content" | "files" | "none";
    const images: Record<string, unknown> = { mode: imgMode };
    if (imgMode === "files") {
      const files: { path: string; alt: string }[] = [];
      for (;;) {
        const p = await ask("Image file path (blank to finish)");
        if (!p) break;
        files.push({ path: p, alt: await ask("  Describe what the image shows (alt text; no client or brand names)") });
      }
      images.files = files;
    }
    brief.images = images;
    const notes = await ask("Anything else the generator should know? (tone, emphasis, what to avoid; blank = none)");
    if (notes) brief.notes = notes;
    const measure = (await ask("Measure SEO/performance before and after? (yes/no)", "yes")).toLowerCase().startsWith("y");
    brief.measure = { enabled: measure, runs: 3, port: 3199 };
    const pr = (await ask("Post the before/after report as a comment on the pull request? (yes/no)", "yes")).toLowerCase().startsWith("y");
    brief.publish = { prComment: pr };
    const parsed = briefSchema.parse(brief);
    console.log("\n  Summary:\n" + JSON.stringify(parsed, null, 2).replace(/^/gm, "    "));
    if (!(await ask("Go ahead? (yes/no)", "yes")).toLowerCase().startsWith("y")) throw new Pause(1, "cancelled");
    return parsed;
  } finally {
    rl.close();
  }
}

/* ---------------------------------------------------------------- helpers */

const targetPath = (b: Brief) => (b.mode === "page" ? `/${b.slug}` : b.page === "home" ? "/" : `/${b.page}`);
const metaFrom = (b: Brief, createdAt: string): RunMeta => ({
  mode: b.mode,
  slug: b.slug,
  title: b.title,
  pageSlug: b.page,
  referenceUrl: b.reference.url,
  refSection: b.reference.section,
  contentSpecs: b.content,
  insert: b.insert,
  nav: b.nav,
  createdAt,
});

function targetFor(b: Brief): Target {
  if (b.mode === "page") return { mode: "page", slug: b.slug!, title: b.title ?? b.slug! };
  const page = pageSchema.parse(readJson(path.join(root, "src", "content", "pages", `${b.page}.json`)));
  return { mode: "section", pageSlug: b.page!, page, insertDescription: resolveInsertIndex(page, b.insert).description };
}

async function snapshot(base: string, paths: string[], runs: number): Promise<Snapshot> {
  const site = await measureSite(base);
  const pages = [];
  for (const p of paths) pages.push(await measurePage(base, p, { runs, log }));
  return { pages, site };
}

/* --------------------------------------------------------------- pipeline */

export async function runPipeline(opts: { runDir?: string; briefFile?: string; flags: Flags }): Promise<number> {
  const flags = opts.flags;
  const started = Date.now();
  let runDir = opts.runDir ? path.resolve(root, opts.runDir) : "";
  let brief: Brief | undefined;

  // --- resume or start
  if (runDir) {
    if (!existsSync(path.join(runDir, "state.json"))) throw new Error(`${runDir} is not a pipeline run folder (no state.json). Older runs: use "apply --run".`);
    brief = briefSchema.parse(readJson(path.join(runDir, "brief.json")));
  } else {
    runDir = path.join(root, ".factory", "runs", `${stamp()}-pending`);
    mkdirSync(runDir, { recursive: true });
    brief = opts.briefFile ? briefSchema.parse(readJson(path.resolve(root, opts.briefFile))) : await interactiveIntake(runDir);
    const newDir = path.join(root, ".factory", "runs", `${stamp()}-${brief.slug ?? brief.page}`);
    if (newDir !== runDir) {
      // rename the pending folder (it may hold typed content files, which brief.content already points at: rewrite them)
      mkdirSync(newDir, { recursive: true });
      brief.content = brief.content.map((c) => (c.startsWith("file:") && c.includes("typed-content") ? (() => { const f = c.slice(5); const dest = path.join(newDir, path.basename(f)); if (existsSync(f)) writeFileSync(dest, readFileSync(f)); return `file:${dest}`; })() : c));
      runDir = newDir;
    }
    writeJson(path.join(runDir, "brief.json"), brief);
    writeJson(path.join(runDir, "state.json"), { startedAt: new Date().toISOString(), steps: { intake: { status: "done", at: new Date().toISOString() } } } satisfies State);
  }
  const statePath = path.join(runDir, "state.json");
  const state = readJson<State>(statePath);
  const save = () => writeJson(statePath, state);
  const done = (id: StepId, status: StepState["status"] = "done", note?: string) => {
    state.steps[id] = { status, at: new Date().toISOString(), note };
    save();
  };
  const b = brief;
  const measureOn = (b.measure?.enabled ?? true) && !flags.noMeasure;
  const runs = b.measure?.runs ?? 3;
  const port = b.measure?.port ?? 3199;
  const headed = flags.headed ?? b.reference.headed ?? false;
  const engine = flags.engine ?? (process.env.ANTHROPIC_API_KEY ? "api" : "prompt");
  const meta = metaFrom(b, state.startedAt);
  const f = (name: string) => path.join(runDir, name);
  const refDir = f("reference");

  console.log(`\nPage factory — ${b.mode === "page" ? `new page /${b.slug}` : `new section on /${b.page}`}`);
  console.log(`Run folder: ${path.relative(root, runDir)}   Engine: ${engine}   Measurement: ${measureOn ? `on (${runs} runs/page)` : "off"}`);

  const step = async (id: StepId, fn: () => Promise<void> | void, opts2: { skip?: boolean } = {}) => {
    const i = STEPS.indexOf(id) + 1;
    const prior = state.steps[id];
    if (prior && (prior.status === "done" || prior.status === "skipped")) return console.log(`[${i}/9] ${TITLES[id]} — already done`);
    if (opts2.skip) {
      console.log(`[${i}/9] ${TITLES[id]} — skipped`);
      return done(id, "skipped");
    }
    console.log(`[${i}/9] ${TITLES[id]}`);
    await fn();
    if (state.steps[id]?.status !== "waiting") done(id);
  };

  try {
    await step("intake", () => {});

    // 2 baseline: the site as it is NOW (before anything is applied)
    await step(
      "baseline",
      async () => {
        buildSite(log);
        const server = await startServer(port, log);
        try {
          writeJson(f("before.json"), await snapshot(server.url, [b.mode === "section" ? targetPath(b) : "/"], runs));
        } finally {
          server.stop();
        }
      },
      { skip: !measureOn || !!flags.skipBaseline },
    );

    // 3 capture
    await step("capture", async () => {
      const ref = await capture(b.reference.url, refDir, { headed, log });
      log(`${ref.sections.length} sections captured`);
    });

    // 4 content (+ images)
    await step("content", async () => {
      const bundle: ContentBundle = await loadContent(b.content, { headed, log });
      const img = b.images ?? { mode: "content" as const };
      if (img.mode === "none") for (const s of bundle.sections) s.images = [];
      if (img.mode === "files") {
        for (const s of bundle.sections) s.images = [];
        const provided = [];
        for (const file of img.files ?? []) provided.push({ src: await importLocalImage(file.path), alt: file.alt });
        if (!provided.length) throw new Error('images.mode is "files" but no image files were given');
        bundle.sections.push({ heading: "Provided images", paragraphs: [], bullets: [], images: provided, links: [], source: "files:provided" });
        log(`${provided.length} provided image(s) imported with neutral names`);
      }
      writeJson(f("content.json"), bundle);
      log(`${bundle.sections.length} content sections`);
    });

    const reference = () => readJson<ReferenceCapture>(path.join(refDir, "reference.json"));
    const content = () => readJson<ContentBundle>(f("content.json"));
    const pack = (retry?: { previousDraft: unknown; errors: string[] }) =>
      buildPromptPack({ target: targetFor(b), reference: reference(), referenceDir: refDir, refSectionMatch: b.reference.section, content: content(), notes: b.notes, retry });

    // 5 generate
    await step("generate", async () => {
      if (existsSync(f("draft.json")) && state.steps.generate?.status === "waiting") return log("draft.json found");
      if (engine === "prompt") {
        const p = pack();
        writePromptPack(p, runDir, targetFor(b));
        done("generate", "waiting", "prompt pack written");
        throw new Pause(10, `Prompt pack written: ${path.relative(root, f("prompt.md"))}\n\nNext: in Claude Code, answer prompt.md (the /new-page or /add-section skill does this), save draft.json in the run folder, then:\n  npm run factory -- resume --run ${path.relative(root, runDir)}`);
      }
      const { output, usage } = await callApi(pack(), { model: flags.model ?? DEFAULT_MODEL, log });
      log(`tokens: ${usage.input} in / ${usage.output} out`);
      writeJson(f("draft.json"), output);
    });
    if (state.steps.generate?.status === "waiting") {
      if (!existsSync(f("draft.json"))) throw new Pause(10, `Still waiting for ${path.relative(root, f("draft.json"))}. Write it (see prompt.md), then resume.`);
      done("generate");
    }

    // 6 apply (engine api retries with the validator's errors)
    await step("apply", async () => {
      const maxRetries = engine === "api" ? (flags.retries ?? 2) : 0;
      for (let attempt = 0; ; attempt++) {
        const draft = readJson<unknown>(f("draft.json"));
        const res = await applyDraft({ meta, draft, content: content(), runDir, force: flags.force, strictGrounding: flags.strictGrounding, log });
        writeJson(f("apply-result.json"), res);
        if (res.ok) {
          log(res.summary);
          return;
        }
        if (attempt >= maxRetries) throw new Pause(3, `The draft was rejected and the site was left untouched:\n${res.errors.map((e) => `  - ${e}`).join("\n")}\n\nFix draft.json, then:\n  npm run factory -- resume --run ${path.relative(root, runDir)}`);
        log(`rejected (${res.errors.length} issue(s)); asking the model to fix them (attempt ${attempt + 2}/${maxRetries + 1})`);
        const { output } = await callApi(pack({ previousDraft: draft, errors: res.errors }), { model: flags.model ?? DEFAULT_MODEL, log });
        writeJson(f("draft.json"), output);
      }
    });

    // 7 after
    await step(
      "after",
      async () => {
        buildSite(log);
        const server = await startServer(port, log);
        try {
          const paths = b.mode === "page" ? ["/", targetPath(b)] : [targetPath(b)];
          writeJson(f("after.json"), await snapshot(server.url, paths, runs));
        } finally {
          server.stop();
        }
      },
      { skip: !measureOn },
    );

    // 8 report
    await step("report", () => {
      const applyRes = readJson<{ files: string[]; warnings: string[]; grounding: import("./ground.mts").GroundingResult; summary: string }>(f("apply-result.json"));
      const before = existsSync(f("before.json")) ? readJson<Snapshot>(f("before.json")) : undefined;
      const after = existsSync(f("after.json")) ? readJson<Snapshot>(f("after.json")) : undefined;
      // Name the NEW section (from the applied draft), not the reference section it was modelled on.
      const draftBlocks = (readJson<{ blocks?: { heading?: string; eyebrow?: string; type: string }[] }>(f("draft.json")).blocks ?? []);
      const sectionName = draftBlocks[0]?.heading ?? draftBlocks[0]?.eyebrow ?? draftBlocks[0]?.type ?? "new section";
      const input: ReportInput = {
        mode: b.mode,
        title: b.mode === "page" ? (b.title ?? b.slug!) : `“${sectionName}” on ${targetPath(b)}`,
        targetPath: targetPath(b),
        referenceUrl: b.reference.url,
        refSection: b.reference.section,
        contentSpecs: b.content.map((c) => (c.includes("typed-content") ? "typed text" : c)),
        engine: engine === "api" ? `Claude API (${flags.model ?? DEFAULT_MODEL})` : "Claude Code (prompt pack)",
        filesChanged: applyRes.files,
        description: applyRes.summary,
        before,
        after,
        grounding: applyRes.grounding,
        warnings: applyRes.warnings,
        runs,
        runFolder: path.relative(root, runDir),
      };
      writeJson(f("report-input.json"), input); // lets `factory report --run` re-render without re-measuring
      const md = renderReport(input);
      writeFileSync(f("report.md"), md);
      log(`report written: ${path.relative(root, f("report.md"))}`);
    });

    // 9 publish
    await step(
      "publish",
      () => {
        const pr = flags.pr ?? b.publish?.pr;
        const r = ghComment(f("report.md"), pr);
        if (r.status === 0) return log(`report posted: ${r.stdout.trim().split("\n").pop()}`);
        log(`could not post the PR comment (${(r.stderr || r.stdout).trim().split("\n")[0]}).`);
        log(`Push the branch and open a pull request, then run: npm run factory -- publish --run ${path.relative(root, runDir)}`);
      },
      { skip: !(flags.pr || b.publish?.prComment) },
    );

    console.log(`\nDone in ${Math.round((Date.now() - started) / 1000)}s.  Report: ${path.relative(root, f("report.md"))}`);
    console.log("Next: review the page, commit on a branch, push, open the pull request.");
    return 0;
  } catch (e) {
    if (e instanceof Pause) {
      console.log(`\n${e.message}`);
      return e.code;
    }
    if (e instanceof ReferenceBlockedError) {
      console.error(`\n${e.message}`);
      return 2;
    }
    console.error(`\nStopped at: ${STEPS.find((s) => !state.steps[s]) ?? "?"}\n${(e as Error).message}\n\nFix the problem, then resume: npm run factory -- resume --run ${path.relative(root, runDir)}`);
    return 1;
  }
}

/** Re-render a finished run's report from its saved measurements (no rebuild, no re-measuring). */
export function regenerateReport(runDirArg: string): string {
  const runDir = path.resolve(root, runDirArg);
  const inputFile = path.join(runDir, "report-input.json");
  if (!existsSync(inputFile)) throw new Error(`no report-input.json in ${runDir} (the run has not reached the report step yet)`);
  const out = path.join(runDir, "report.md");
  writeFileSync(out, renderReport(readJson<ReportInput>(inputFile)));
  return out;
}

/** `gh pr comment` with the report as the body. PR = the given number, else the current branch's PR. */
function ghComment(bodyFile: string, pr?: number) {
  const repo = process.env.FACTORY_GH_REPO ? ` -R ${process.env.FACTORY_GH_REPO}` : "";
  return spawnSync(`gh pr comment ${pr ?? ""} --body-file "${bodyFile}"${repo}`, { cwd: root, encoding: "utf8", shell: true });
}

/** Re-post an existing run's report (after the PR exists). */
export function publishRun(runDirArg: string, pr?: number): number {
  const runDir = path.resolve(root, runDirArg);
  const report = path.join(runDir, "report.md");
  if (!existsSync(report)) throw new Error(`no report.md in ${runDir}`);
  const r = ghComment(report, pr);
  console.log((r.stdout || r.stderr).trim());
  return r.status ?? 1;
}
