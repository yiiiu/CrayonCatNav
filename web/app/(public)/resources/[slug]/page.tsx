import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { findPublishedBySlug } from "@/lib/data/resource.repo";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const resource = await findPublishedBySlug(slug);
  if (!resource) return {};
  return { title: resource.name, description: resource.summary, alternates: { canonical: `/resources/${slug}` } };
}

export default function ResourceDetailPage({ params }: Props) {
  return (
    <Suspense fallback={<p>加载中…</p>}>
      <ResourceDetail params={params} />
    </Suspense>
  );
}

/** 资源详情骨架：草稿/下架/不存在一律 404。 */
async function ResourceDetail({ params }: Props) {
  const { slug } = await params;
  const resource = await findPublishedBySlug(slug);
  if (!resource) notFound();
  return (
    <article>
      <h1>{resource.name}</h1>
      <p>{resource.summary}</p>
    </article>
  );
}
