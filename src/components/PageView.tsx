import type { PageDefinition } from "@/blocks/types";
import { BlockRenderer } from "@/blocks";
import { JsonLd } from "@/components/ui";
import { ReferenceTag } from "@/components/ReferenceTag";
import { breadcrumbLd, webPageLd } from "@/lib/seo";

const labels: Record<string, string> = {
  "/work": "Work",
  "/about": "About",
  "/careers": "Careers",
  "/contact": "Contact",
  "/privacy": "Privacy policy",
};

export function crumbsFor(path: string, leaf?: string) {
  const crumbs = [{ name: "Home", href: "/" }];
  if (path === "/") return crumbs;
  const parts = path.split("/").filter(Boolean);
  let acc = "";
  parts.forEach((p, i) => {
    acc += `/${p}`;
    const last = i === parts.length - 1;
    crumbs.push({ name: last && leaf ? leaf : (labels[acc] ?? p), href: acc });
  });
  return crumbs;
}

export function PageView({ page }: { page: PageDefinition }) {
  const crumbs = crumbsFor(page.path);
  return (
    <>
      <JsonLd
        data={webPageLd({
          type: page.seo.schemaType ?? "WebPage",
          name: page.seo.title,
          description: page.seo.description,
          path: page.path,
        })}
      />
      {page.path !== "/" && <JsonLd data={breadcrumbLd(crumbs)} />}
      <BlockRenderer blocks={page.blocks} ctx={{ crumbs }} />
      <ReferenceTag reference={page.reference} />
    </>
  );
}
