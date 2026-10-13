import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageView } from "@/components/PageView";
import { getPage, listPageSlugs } from "@/lib/pages";
import { buildMetadata } from "@/lib/seo";

// Every JSON file in src/content/pages (except home) becomes a statically generated route.
export async function generateStaticParams() {
  return (await listPageSlugs()).filter((s) => s !== "home").map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return {};
  return buildMetadata({
    title: page.seo.title,
    description: page.seo.description,
    path: page.path,
    noindex: page.seo.noindex,
  });
}

export default async function StaticPage({ params }: PageProps<"/[slug]">) {
  const { slug } = await params;
  if (slug === "home") notFound();
  const page = await getPage(slug);
  if (!page) notFound();
  return <PageView page={page} />;
}
