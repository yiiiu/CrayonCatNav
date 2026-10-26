import Link from "next/link";
import { connection } from "next/server";
import { AdminTop } from "@/components/admin/AdminTop";
import styles from "@/components/admin/admin.module.css";
import a from "@/components/admin/agent.module.css";
import { CandidateCard, type CandidateView } from "@/components/admin/CandidateCard";
import { Card, ChipLink, ScrollArea } from "@/components/ui";
import { candidateStatuses, candidateStatusLabels, sourceLabels, type CandidateSource, type CandidateStatusValue } from "@/lib/agent/types";
import { countCandidatesByStatus, listCandidates, loadClosedSuggestions, loadTaxonomy } from "@/lib/data/agent.repo";
import { candidatePayloadSchema } from "@/lib/validation/candidate";
import { pricingLabels } from "@/lib/validation/resource";
import { rejectCandidateAction, reviewCandidateAction } from "../actions";

export const metadata = { title: "候选箱" };

type SP = Promise<Record<string, string | undefined>>;

const day = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" });
const dayTime = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

export default async function CandidatesPage({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const status: CandidateStatusValue = candidateStatuses.includes(sp.status as CandidateStatusValue) ? (sp.status as CandidateStatusValue) : "pending";
  const page = Math.max(1, Math.min(500, Number.parseInt(sp.page ?? "1", 10) || 1));
  const [{ categories }, ignored] = await Promise.all([loadTaxonomy(), loadClosedSuggestions()]);
  // 已忽略的建议词不再预填到审核输入框
  const ignoredSlugs = new Set(ignored.map((x) => x.slug));
  // 分类筛选：按候选当前的 categorySlug；不认识的值忽略
  const cat = categories.some((c) => c.slug === sp.cat) ? sp.cat! : null;
  const [counts, { total, items, pageSize }] = await Promise.all([countCandidatesByStatus(cat), listCandidates(status, page, cat)]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const catName = new Map(categories.map((c) => [c.slug, c.name]));
  const href = (patch: { status?: string; page?: number; cat?: string | null }) => {
    const p = new URLSearchParams();
    const st = patch.status ?? status;
    const c = patch.cat === undefined ? cat : patch.cat;
    if (st !== "pending") p.set("status", st);
    if (c) p.set("cat", c);
    if (patch.page && patch.page > 1) p.set("page", String(patch.page));
    const s = p.toString();
    return s ? `/admin/candidates?${s}` : "/admin/candidates";
  };

  // 审核后回到当前筛选（状态 / 分类 / 页码），不重置为全部分类
  const filter = { status, cat, page };

  const views: CandidateView[] = items.map((c) => {
    const parsed = candidatePayloadSchema.safeParse(c.payload);
    const p = parsed.success
      ? parsed.data
      : { name: c.name, slug: "", summary: "", description: "", categorySlug: "", tags: [], websiteUrl: null, githubUrl: null, pricingType: "unknown" as const, toolSlugs: [], suggestedTags: [] };
    return {
      id: c.id,
      status: c.status,
      sourceLabel: sourceLabels[c.source as CandidateSource] ?? c.source,
      sourceUrl: c.sourceUrl,
      name: p.name,
      slug: p.slug,
      summary: p.summary,
      description: p.description,
      categorySlug: p.categorySlug,
      categoryName: catName.get(p.categorySlug) ?? null,
      targetName: c.run?.category?.name ?? null,
      offTarget: !!c.run?.category && c.run.category.slug !== p.categorySlug,
      tags: p.tags,
      suggestedTags: p.suggestedTags.filter((t) => !ignoredSlugs.has(t.slug)),
      websiteUrl: p.websiteUrl,
      githubUrl: p.githubUrl,
      pricingLabel: pricingLabels[p.pricingType],
      toolSlugs: p.toolSlugs,
      reason: c.reason,
      confidence: c.confidence,
      stars: c.stars,
      sourceUpdatedAt: c.sourceUpdatedAt ? day.format(c.sourceUpdatedAt) : null,
      rawSummary: c.rawSummary,
      createdAt: dayTime.format(c.createdAt),
      resource: c.resource,
    };
  });

  return (
    <>
      <AdminTop title="候选箱">
        <Link href="/admin/agent">采集 Agent 设置 ›</Link>
      </AdminTop>
      {sp.done && <p className={styles.ok} role="status">{sp.done.slice(0, 200)}</p>}
      <Card className={styles.fill}>
        <div className={styles.toolbar}>
          <div className={styles.seg} role="group" aria-label="状态">
            {candidateStatuses.map((s) => (
              <ChipLink key={s} href={href({ status: s })} active={status === s}>
                {candidateStatusLabels[s]}
                <span className={a.count}>{counts[s]}</span>
              </ChipLink>
            ))}
          </div>
          <span className={styles.hint}>Agent 只整理、不上架；每条都需要人工确认。拒绝后同一链接不再推送。</span>
        </div>
        <div className={`${styles.seg} ${a.catFilter}`} role="group" aria-label="按分类筛选">
          <ChipLink href={href({ cat: null, page: 1 })} active={!cat}>
            全部分类
          </ChipLink>
          {categories.map((x) => (
            <ChipLink key={x.slug} href={href({ cat: x.slug, page: 1 })} active={cat === x.slug}>
              {x.name}
            </ChipLink>
          ))}
        </div>
        <ScrollArea className={`${styles.scroll} ${styles.body}`} viewportClassName={a.list}>
          {views.length === 0 && (
            <p className={styles.muted}>{status === "pending" ? "暂无待审核的候选，去「采集 Agent」开始一次采集吧" : "这里还没有记录"}</p>
          )}
          {views.map((c) => (
            <CandidateCard
              key={c.id}
              c={c}
              categories={categories}
              review={reviewCandidateAction.bind(null, c.id, filter)}
              reject={rejectCandidateAction.bind(null, c.id, filter)}
            />
          ))}
        </ScrollArea>
        <div className={styles.pager}>
          <span>共 {total} 条</span>
          {pages > 1 && (
            <nav aria-label="分页">
              {page > 1 && <Link href={href({ page: page - 1 })}>‹ 上一页</Link>}
              <span>
                {page} / {pages}
              </span>
              {page < pages && <Link href={href({ page: page + 1 })}>下一页 ›</Link>}
            </nav>
          )}
        </div>
      </Card>
    </>
  );
}
