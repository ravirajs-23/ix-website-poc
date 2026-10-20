/**
 * Build the site and serve the production build on a private port, for measuring.
 */
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");

/** `npm run build` (includes the page validator). Throws with the tail of the output on failure. */
export function buildSite(log: (m: string) => void = () => {}): void {
  log("building the site (npm run build)");
  const r = spawnSync("npm run build", { cwd: root, encoding: "utf8", shell: true, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) {
    const out = `${r.stdout}\n${r.stderr}`.trim().split("\n").slice(-25).join("\n");
    throw new Error(`build failed (exit ${r.status}):\n${out}`);
  }
}

export type RunningServer = { url: string; stop: () => void };

export async function startServer(port: number, log: (m: string) => void = () => {}): Promise<RunningServer> {
  const url = `http://localhost:${port}`;
  const child = spawn(process.execPath, [nextBin, "start", "-p", String(port)], { cwd: root, stdio: "ignore", env: { ...process.env, NODE_ENV: "production" } });
  const stop = () => {
    if (child.pid === undefined) return;
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  };
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${url}/`, { signal: AbortSignal.timeout(3000) });
      if (res.ok) {
        log(`serving the production build at ${url}`);
        return { url, stop };
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  stop();
  throw new Error(`the production server did not start on port ${port} within 90s (is the port in use?)`);
}
