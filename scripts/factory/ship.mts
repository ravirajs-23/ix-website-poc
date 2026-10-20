/**
 * SHIP: send a finished change for review without the person touching git.
 *
 *   branch (a new one if on main) -> commit -> push to BOTH remotes (never forced) -> open the pull request
 *   -> post the full before/after report as a comment.
 *
 * GitHub is the source of truth (the pull request lives there); GitLab is kept in step. A remote that is
 * not configured is skipped with a note. Nothing is ever force-pushed or overwritten.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const git = (args: string[]) => spawnSync("git", args, { cwd: root, encoding: "utf8" });
const out = (r: ReturnType<typeof git>) => `${r.stdout}${r.stderr}`.trim();
const gh = (args: string[]) => spawnSync("gh", args, { cwd: root, encoding: "utf8", shell: false });

export type ShipOptions = {
  /** Plain title of the change, e.g. "Add Our Values page". Becomes the commit message and the PR title. */
  title: string;
  /** Run folder holding report.md / verdict.txt (optional). */
  run?: string;
  /** Branch to use; default feature/<title>. If already on a non-main branch, that branch is kept. */
  branch?: string;
  /** Skip opening the pull request (push only). */
  noPr?: boolean;
  /** Show what would happen; change nothing. */
  dryRun?: boolean;
  base?: string;
  log?: (m: string) => void;
};
export type ShipResult = { ok: boolean; branch: string; pushed: string[]; skipped: string[]; prUrl?: string; message: string };

const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "change";

export function ship(o: ShipOptions): ShipResult {
  const log = o.log ?? (() => {});
  const base = o.base ?? "main";
  const fail = (message: string, branch = ""): ShipResult => ({ ok: false, branch, pushed: [], skipped: [], message });

  if (git(["rev-parse", "--is-inside-work-tree"]).status !== 0) return fail("This folder is not a git repository, so the change cannot be sent for review.");
  const status = out(git(["status", "--porcelain"]));
  if (!status) return fail("There is nothing to send: no changes were found.");

  if (o.dryRun) {
    const cur = out(git(["rev-parse", "--abbrev-ref", "HEAD"]));
    const target = cur === base || cur === "master" || cur === "HEAD" || o.branch ? (o.branch ?? `feature/${slugify(o.title)}`) : cur;
    const files = status.split(/\r?\n/).map((l) => l.trim());
    const remotes = out(git(["remote"])).split(/\s+/).filter(Boolean);
    return {
      ok: true,
      branch: target,
      pushed: [],
      skipped: [],
      message: `Dry run: would save ${files.length} changed file(s) on branch ${target}, send to ${["github", "origin"].filter((r) => remotes.includes(r)).join(" and ") || "no remote"}${o.noPr ? "" : ", open a pull request"} and post the report.\n  ${files.join("\n  ")}`,
    };
  }

  // 1) branch
  let branch = out(git(["rev-parse", "--abbrev-ref", "HEAD"]));
  if (branch === base || branch === "master" || branch === "HEAD" || o.branch) {
    branch = o.branch ?? `feature/${slugify(o.title)}`;
    const exists = git(["rev-parse", "--verify", "--quiet", branch]).status === 0;
    const sw = git(exists ? ["switch", branch] : ["switch", "-c", branch]);
    if (sw.status !== 0) return fail(`Could not switch to the branch ${branch}: ${out(sw)}`, branch);
    log(`working on branch ${branch}`);
  }

  // 2) commit (only what .gitignore allows; run artefacts in .factory are ignored)
  const add = git(["add", "-A"]);
  if (add.status !== 0) return fail(`Could not stage the changes: ${out(add)}`, branch);
  const commit = git(["commit", "-m", o.title]);
  if (commit.status !== 0) return fail(`Could not save the change: ${out(commit)}`, branch);
  log(`saved: ${o.title}`);

  // 3) push to both remotes, fast-forward only
  const remotes = out(git(["remote"])).split(/\s+/).filter(Boolean);
  const pushed: string[] = [];
  const skipped: string[] = [];
  for (const name of ["github", "origin"]) {
    if (!remotes.includes(name)) {
      skipped.push(`${name} (not set up on this machine)`);
      continue;
    }
    const p = git(["push", "-u", name, branch]);
    if (p.status === 0) {
      pushed.push(name);
      log(`sent to ${name}`);
    } else {
      skipped.push(`${name} (${out(p).split("\n").pop()})`);
    }
  }
  if (!pushed.includes("github")) return { ok: false, branch, pushed, skipped, message: `The change is saved on branch ${branch} but could not be sent to GitHub: ${skipped.join("; ")}. A developer can help with sign-in.` };
  if (o.noPr) return { ok: true, branch, pushed, skipped, message: `Sent to ${pushed.join(" and ")}. No pull request was opened.` };

  // 4) pull request on GitHub
  const repoArgs = process.env.FACTORY_GH_REPO ? ["-R", process.env.FACTORY_GH_REPO] : [];
  const runDir = o.run ? path.resolve(root, o.run) : undefined;
  const verdictFile = runDir && path.join(runDir, "verdict.txt");
  const reportFile = runDir && path.join(runDir, "report.md");
  const verdict = verdictFile && existsSync(verdictFile) ? readFileSync(verdictFile, "utf8").trim() : "";
  const body = [
    "Prepared with the page factory and ready for developer review.",
    "",
    verdict ? `**Quick check**\n\n${verdict.split("\n").map((l) => `- ${l}`).join("\n")}` : "",
    reportFile && existsSync(reportFile) ? "\nThe full before/after report is in the first comment below." : "",
    "",
    "🤖 Generated with [Claude Code](https://claude.com/claude-code)",
  ].join("\n");
  const bodyFile = path.join(root, ".factory", "pr-body.md");
  writeFileSync(bodyFile, body);

  const existing = gh(["pr", "view", branch, "--json", "url", "-q", ".url", ...repoArgs]);
  let prUrl = existing.status === 0 ? existing.stdout.trim() : "";
  if (!prUrl) {
    const created = gh(["pr", "create", "--base", base, "--head", branch, "--title", o.title, "--body-file", bodyFile, ...repoArgs]);
    if (created.status !== 0) return { ok: false, branch, pushed, skipped, message: `Sent to ${pushed.join(" and ")}, but the pull request could not be opened: ${out(created).split("\n").pop()}. A developer can open it from the branch ${branch}.` };
    prUrl = created.stdout.trim().split("\n").pop() ?? "";
    log("pull request opened");
  } else log("this branch already has a pull request; updated it");

  // 5) the full report as a comment
  if (reportFile && existsSync(reportFile)) {
    const c = gh(["pr", "comment", prUrl, "--body-file", reportFile]);
    if (c.status === 0) log("full before/after report posted on the pull request");
    else log(`could not post the report comment (${out(c).split("\n").pop()})`);
  }
  return { ok: true, branch, pushed, skipped, prUrl, message: `Sent to ${pushed.join(" and ")} and opened a pull request for a developer to review.` };
}
