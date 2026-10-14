import type { MetadataRoute } from "next";
import { NOINDEX, absoluteUrl } from "@/lib/site";

// AI crawlers are explicitly allowed so the site can be indexed and cited by AI search and assistants.
const aiCrawlers = [
  "GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot",
  "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "CCBot",
  "Bytespider", "Amazonbot", "cohere-ai", "Meta-ExternalAgent", "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  // Demo/staging: block everything (see NOINDEX in lib/site.ts).
  if (NOINDEX) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/api/"] },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: "/", disallow: ["/api/"] })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: absoluteUrl("/"),
  };
}
