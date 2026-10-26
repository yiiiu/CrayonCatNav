import type { Metadata } from "next";
import { Breadcrumb } from "@/components/ui";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import styles from "@/components/tool/tool.module.css";
import { isPubliclyListed } from "@/lib/tools/metas";
import { getTool, toolRegistry } from "@/lib/tools/registry";

type Props = { params: Promise<{ slug: string }> };

/** proxy.ts 把注册表外的 slug 改写到这里；预渲染成 404，保证真实 404 状态码。 */
const NOT_FOUND_SLUG = "__none__";

export function generateStaticParams() {
  return [...toolRegistry.filter(isPubliclyListed).map((t) => ({ slug: t.slug })), { slug: NOT_FOUND_SLUG }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tool = getTool((await params).slug);
  if (!tool) return { title: "工具不存在", robots: { index: false } };
  return { title: tool.name, description: tool.description, alternates: { canonical: `/tools/${tool.slug}` } };
}

export default async function ToolPage({ params }: Props) {
  const tool = getTool((await params).slug);
  if (!tool || !isPubliclyListed(tool)) notFound();
  const { default: ToolUI } = await tool.load();
  return (
    <>
      <Breadcrumb items={[{ label: "工具箱", href: "/tools" }, { label: tool.name }]} extra={`/tools/${tool.slug}`} />
      <header className={styles.thead}>
        <h1>{tool.name}</h1>
        <p>{tool.description}</p>
        <span className={styles.badge}>🔒 仅在本地浏览器处理，不上传</span>
      </header>
      <Suspense fallback={<div>加载工具…</div>}>
        <ToolUI />
      </Suspense>
    </>
  );
}
