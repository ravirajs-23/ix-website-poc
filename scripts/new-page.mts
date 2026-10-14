/**
 * Scaffold a new static page.
 *
 *   npm run new:page -- <slug> "<Page title>" [--reference <url>] [--ref-name "<Site — Page>"] [--nav "<Nav label>"]
 *
 * Creates src/content/pages/<slug>.json with a hero, one text section and a CTA (all marked TODO so
 * `validate:pages` fails until real content replaces them). Optionally adds the page to the header nav.
 * The /new-page skill (.claude/skills/new-page) wraps this with reference analysis and content mapping.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith("--") && !(i > 0 && args[i - 1].startsWith("--")));
const [slug, title] = positional;

if (!slug || !title || !/^[a-z][a-z0-9-]*$/.test(slug)) {
  console.error('Usage: npm run new:page -- <slug> "<Page title>" [--reference <url>] [--ref-name "<name>"] [--nav "<label>"]\n(slug: lowercase letters, digits, hyphens)');
  process.exit(1);
}

const file = path.join(root, "src", "content", "pages", `${slug}.json`);
if (existsSync(file)) {
  console.error(`Refusing to overwrite ${path.relative(root, file)}`);
  process.exit(1);
}

const referenceUrl = flag("reference");
const page = {
  path: `/${slug}`,
  ...(referenceUrl ? { reference: { name: flag("ref-name") ?? new URL(referenceUrl).hostname, url: referenceUrl } } : {}),
  seo: {
    title: `${title}`,
    description: "TODO: 120-160 character description of this page for search results.",
    summary: "TODO: one sentence an AI assistant could quote about this page.",
  },
  blocks: [
    { type: "hero", variant: "light", eyebrow: title, title: `TODO: ${title} headline`, subtitle: "TODO: supporting sentence" },
    { type: "richText", heading: "TODO: section heading", paragraphs: ["TODO: content"] },
    {
      type: "cta",
      heading: "Ready to talk?",
      body: "Tell us about your challenge and our team will show you how we would approach it.",
      primary: { label: "Speak with us", href: "/contact" },
    },
  ],
};
writeFileSync(file, JSON.stringify(page, null, 2) + "\n");
console.log(`created ${path.relative(root, file)}`);

const navLabel = flag("nav");
if (navLabel) {
  const siteFile = path.join(root, "src", "lib", "site.ts");
  const src = readFileSync(siteFile, "utf8");
  const re = /(export const nav: NavItem\[\] = \[\n)([\s\S]*?)(\];)/;
  if (re.test(src) && !src.includes(`href: "/${slug}"`)) {
    writeFileSync(siteFile, src.replace(re, (_m, a, body, c) => `${a}${body}  { label: ${JSON.stringify(navLabel)}, href: "/${slug}" },\n${c}`));
    console.log(`added "${navLabel}" to the header nav (src/lib/site.ts)`);
  }
}
console.log("\nNext: replace every TODO, then run  npm run validate:pages  and  npm run build.");
