import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isPubliclyListed } from "@/lib/tools/metas";
import { getTool, toolRegistry } from "@/lib/tools/registry";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return toolRegistry.filter(isPubliclyListed).map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getTool((await params).slug);
  if (!tool) return {};
  return { title: tool.name, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` } };
}

export default async function ToolPage({ params }: Props) {
  const tool = getTool((await params).slug);
  if (!tool || !isPubliclyListed(tool)) notFound();
  const { default: ToolUI } = await tool.load();
  return (
    <>
      <h1>{tool.name}</h1>
      <p style={{ color: "var(--ink-2)" }}>{tool.description} · 本地运算，不上传</p>
      <ToolUI />
    </>
  );
}
