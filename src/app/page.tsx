import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageView } from "@/components/PageView";
import { getPage } from "@/lib/pages";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage("home");
  if (!page) return {};
  return {
    ...buildMetadata({ title: page.seo.title, description: page.seo.description, path: "/" }),
    title: { absolute: page.seo.title },
  };
}

export default async function Home() {
  const page = await getPage("home");
  if (!page) notFound();
  return <PageView page={page} />;
}
