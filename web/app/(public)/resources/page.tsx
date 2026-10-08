import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResourceCard } from "@/components/resource/ResourceCard";
import { ResourceFilters } from "@/components/resource/ResourceFilters";
import styles from "@/components/resource/resource.module.css";
import { ButtonLink, ChipLink, EmptyState, SearchBox } from "@/components/ui";
import { searchPublished } from "@/lib/data/resource.repo";
import { listCategoriesWithCounts, listUsedTags } from "@/lib/data/taxonomy.repo";
import { buildSearchHref, parsePublicSearch } from "@/lib/validation/search";

export const metadata: Metadata = {
  title: "发现 AI 资源",
  description: "按分类、标签和关键词筛选 MCP、Agent Skills、模型 API 与 AI 工具。",
  alternates: { canonical: "/resources" },
};

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function ResourcesPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<p>加载中…</p>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: { searchParams: SP }) {
  const current = parsePublicSearch(await searchParams);
  const [categories, tags, { total, items, pageSize }] = await Promise.all([
    listCategoriesWithCounts(),
    listUsedTags(),
    searchPublished(current),
  ]);
  const cat = categories.find((c) => c.slug === current.cat);
  const tag = tags.find((t) => t.slug === current.tag);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const heading = cat ? `${cat.name} · ${total} 条` : `${total} 条`;

  return (
    <>
      <h1 className="sr-only">发现资源</h1>
      <div className={styles.layout}>
        <ResourceFilters current={current} categories={categories} tags={tags} />
        <div>
          <div className={styles.listtop}>
            <SearchBox
              defaultValue={current.q}
              placeholder={cat ? `在 ${cat.name} 里搜索…` : "搜索 MCP、Agent、模型…"}
              hidden={{ cat: current.cat, tag: current.tag }}
            />
            <span className={styles.count} role="status">
              {heading}
            </span>
          </div>

          {(current.q || tag) && (
            <div className={styles.pills}>
              <small>已筛选</small>
              {current.q && <ChipLink href={buildSearchHref(current, { q: undefined })}>关键词：{current.q} ×</ChipLink>}
              {tag && <ChipLink href={buildSearchHref(current, { tag: undefined })}>标签：{tag.name} ×</ChipLink>}
            </div>
          )}

          {items.length === 0 ? (
            <div style={{ marginTop: 22 }}>
              <EmptyState title="没找到匹配的资源">
                <p>换个关键词，或者清空筛选条件再看看。</p>
                <ButtonLink href="/resources" variant="primary">
                  清空筛选
                </ButtonLink>
              </EmptyState>
            </div>
          ) : (
            <div className={styles.grid2}>
              {items.map((r) => (
                <ResourceCard key={r.id} r={r} />
              ))}
            </div>
          )}

          {pages > 1 && (
            <nav className={styles.pager} aria-label="分页">
              {current.page > 1 ? <Link href={buildSearchHref(current, { page: current.page - 1 })}>‹ 上一页</Link> : <span />}
              <span>
                {current.page} / {pages}
              </span>
              {current.page < pages ? <Link href={buildSearchHref(current, { page: current.page + 1 })}>下一页 ›</Link> : <span />}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
