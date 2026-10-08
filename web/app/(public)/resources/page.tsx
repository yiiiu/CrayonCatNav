import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = { title: "发现资源", alternates: { canonical: "/resources" } };

type SearchParams = Promise<{ q?: string; cat?: string; tag?: string; page?: string }>;

export default function ResourcesPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <h1>发现资源</h1>
      <Suspense fallback={<p>加载中…</p>}>
        <Results searchParams={searchParams} />
      </Suspense>
    </>
  );
}

/** 资源列表骨架：URL 即状态（q / cat / tag / page），搜索在内容闭环阶段接入。 */
async function Results({ searchParams }: { searchParams: SearchParams }) {
  const { q } = await searchParams;
  return <EmptyState title={q ? `「${q}」的搜索即将上线` : "资源库建设中"}>首批资源正在人工核实。</EmptyState>;
}
