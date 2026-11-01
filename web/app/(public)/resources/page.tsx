import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ResourceCard } from "@/components/resource/ResourceCard";
import { ResourceFilters } from "@/components/resource/ResourceFilters";
import styles from "@/components/resource/resource.module.css";
import { ButtonLink, ChipLink, EmptyState, SearchBox } from "@/components/ui";
import { searchPublished } from "@/lib/data/resource.repo";
import { listCategoriesWithCounts, listUsedTags } from "@/lib/data/taxonomy.repo";
import { pricingLabels } from "@/lib/validation/resource";
import { platformLabels } from "@/lib/validation/resource-details";
import { PRICES, SORTS, buildSearchHref, parsePublicSearch, sortLabels } from "@/lib/validation/search";

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
              hidden={{ cat: current.cat, tag: current.tag, sort: current.sort, price: current.price, platform: current.platform }}
              live="filter"
            />
            <span className={styles.count} role="status">
              {heading}
            </span>
          </div>

          <div className={styles.toolbar}>
            <div className={styles.seg} role="group" aria-label="排序">
              <small>排序</small>
              <ChipLink flat active={!current.sort} href={buildSearchHref(current, { sort: undefined })}>
                {sortLabels.default}
              </ChipLink>
              {SORTS.map((s) => (
                <ChipLink flat key={s} active={current.sort === s} href={buildSearchHref(current, { sort: s })}>
                  {sortLabels[s]}
                </ChipLink>
              ))}
            </div>
            <div className={styles.seg} role="group" aria-label="定价">
              <small>定价</small>
              <ChipLink flat active={!current.price} href={buildSearchHref(current, { price: undefined })}>
                全部
              </ChipLink>
              {PRICES.map((p) => (
                <ChipLink flat key={p} active={current.price === p} href={buildSearchHref(current, { price: current.price === p ? undefined : p })}>
                  {pricingLabels[p]}
                </ChipLink>
              ))}
            </div>
          </div>

          {(current.q || tag || current.platform) && (
            <div className={styles.pills}>
              <small>已筛选</small>
              {current.q && <ChipLink href={buildSearchHref(current, { q: undefined })}>关键词：{current.q} ×</ChipLink>}
              {tag && <ChipLink href={buildSearchHref(current, { tag: undefined })}>标签：{tag.name} ×</ChipLink>}
              {current.platform && <ChipLink href={buildSearchHref(current, { platform: undefined })}>平台：{platformLabels[current.platform]} ×</ChipLink>}
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
            <div className={styles.gridList}>
              {items.map((r) => (
                <ResourceCard key={r.id} r={r} hideCategory={Boolean(cat)} />
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
