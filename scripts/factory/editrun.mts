/**
 * Runs one edit plan as a small pipeline:  preview -> (baseline measure) -> apply + validate -> (measure again) -> report.
 * Exit codes: 0 done · 3 rejected by the checks (nothing changed) · 4 needs --yes (destructive) · 1 error
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commitPlan, type Plan } from "./edit.mts";
import { measurePage, measureSite } from "./measure.mts";
import { renderReport, shortVerdict, type ReportInput, type Snapshot } from "./report.mts";
import { buildSite, startServer } from "./serve.mts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const stamp = () => new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14);
const log = (m: string) => console.log(`    ${m}`);
const writeJson = (file: string, v: unknown) => writeFileSync(file, JSON.stringify(v, null, 2) + "\n");

export type EditFlags = { measure: boolean; yes: boolean; dryRun: boolean; runs: number; port: number };

async function snapshot(paths: string[], flags: EditFlags): Promise<Snapshot> {
  buildSite(log);
  const server = await startServer(flags.port, log);
  try {
    const pages = [];
    for (const p of paths) pages.push(await measurePage(server.url, p, { runs: flags.runs, log }));
    return { pages, site: await measureSite(server.url) };
  } finally {
    server.stop();
  }
}

export async function runEdit(plan: Plan, flags: EditFlags): Promise<number> {
  console.log(`\n${plan.summary}`);
  for (const l of plan.preview) console.log(`  ${l}`);
  for (const w of plan.warnings) console.log(`  ! ${w}`);
  if (flags.dryRun) {
    console.log("\n(dry run: nothing was changed)");
    return 0;
  }
  if (plan.destructive && !flags.yes) {
    console.log("\nThis removes something. Nothing was changed. Run again with --yes to confirm.");
    return 4;
  }

  const runDir = path.join(root, ".factory", "runs", `${stamp()}-edit-${plan.op}`);
  mkdirSync(runDir, { recursive: true });
  writeJson(path.join(runDir, "plan.json"), { ...plan, changes: plan.changes.map((c) => ({ file: path.relative(root, c.file), removed: c.content === null })) });
  const measure = flags.measure;
  const paths = plan.affectedPaths;

  let before: Snapshot | undefined;
  if (measure) {
    console.log("\n[1/3] Checking the site as it is now");
    before = await snapshot(paths, flags);
    writeJson(path.join(runDir, "before.json"), before);
  }

  console.log(`\n[${measure ? 2 : 1}/${measure ? 3 : 1}] Making the change and checking the site rules`);
  const res = commitPlan(plan);
  writeJson(path.join(runDir, "apply-result.json"), res);
  if (!res.ok) {
    console.log("\nThe change was NOT made (the site is exactly as it was). The checks said:");
    for (const e of res.errors) console.log(`  - ${e}`);
    return 3;
  }
  log(`changed: ${res.files.join(", ")}`);

  let after: Snapshot | undefined;
  if (measure) {
    console.log("\n[3/3] Checking the site again");
    after = await snapshot(paths, flags);
    writeJson(path.join(runDir, "after.json"), after);
  }

  const input: ReportInput = {
    mode: "edit",
    title: plan.summary.replace(/\.$/, ""),
    targetPath: paths[0] ?? "/",
    engine: "Page factory (edit)",
    filesChanged: res.files,
    description: plan.summary,
    preview: plan.preview,
    before,
    after,
    grounding: { checked: 0, grounded: 0, ungrounded: [] },
    warnings: res.warnings,
    runs: flags.runs,
    runFolder: path.relative(root, runDir).replace(/\\/g, "/"),
  };
  writeJson(path.join(runDir, "report-input.json"), input);
  writeFileSync(path.join(runDir, "report.md"), renderReport(input));
  const verdict = shortVerdict(input);
  writeFileSync(path.join(runDir, "verdict.txt"), verdict.join("\n") + "\n");

  console.log(`\nDone. ${plan.summary}`);
  for (const v of verdict) console.log(`  ${v}`);
  console.log(`Report: ${path.relative(root, path.join(runDir, "report.md"))}`);
  return 0;
}
