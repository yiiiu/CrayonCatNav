import { z } from "zod";
import { normalizeQuery, scoreItem, tokenize } from "@/lib/recommend/prefilter";

/**
 * Agent 接入的纯逻辑（规格 docs/spec/Agent接入方案.md §3）：入参校验 + 内存筛选 / 打分 / 分页。
 * HTTP API、MCP、Skill、CLI 共用；不依赖数据库与 DOM，方便单测。
 */

export const PRICING = ["free", "freemium", "paid"] as const;
export type Pricing = (typeof PRICING)[number];

export const SEARCH_LIMIT_DEFAULT = 10;
export const SEARCH_LIMIT_MAX = 20;
export const QUERY_MAX = 100;
export const TAGS_MAX = 5;
export const TAG_LIST_MAX = 50;

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,79}$/, "slug 只能是小写字母、数字和连字符");

export const categoryParam = slug.describe("分类 slug，来自 list_categories，如 ui-components / Category slug from list_categories");

export const searchInput = z.object({
  query: z
    .string()
    .trim()
    .max(QUERY_MAX, `query 最多 ${QUERY_MAX} 字`)
    .optional()
    .describe("关键词或需求描述，中英文均可 / Keywords or a short description of what you need"),
  category: categoryParam.optional(),
  tags: z
    .array(slug)
    .max(TAGS_MAX, `tags 最多 ${TAGS_MAX} 个`)
    .optional()
    .describe("标签 slug（需同时具备），来自 list_tags / Tag slugs from list_tags; all must match"),
  pricing: z.enum(PRICING).optional().describe("价格类型 / Pricing: free | freemium | paid"),
  limit: z.coerce.number().int().min(1).max(SEARCH_LIMIT_MAX).default(SEARCH_LIMIT_DEFAULT).describe(`返回条数 1–${SEARCH_LIMIT_MAX} / Page size`),
  cursor: z
    .string()
    .regex(/^\d{1,4}$/, "cursor 不合法")
    .optional()
    .describe("上一页返回的 nextCursor / nextCursor from the previous page"),
});
export type SearchInput = z.input<typeof searchInput>;
export type SearchParams = z.output<typeof searchInput>;

export const resourceInput = z.object({ slug: slug.describe("资源 slug，来自 search_resources / Resource slug from search_resources") });
export const tagsInput = z.object({ category: categoryParam.optional() });

/** zod 错误 → 一句给 Agent 看的提示（字段名 + 原因），方便它改参数重试。 */
export function describeIssues(err: z.ZodError): string {
  return err.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "input"}: ${i.message}`)
    .join("; ");
}

export type AgentCatalogRow = {
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  pricingType: "unknown" | Pricing;
  featuredOrder: number | null;
  category: { slug: string; name: string };
  tags: { slug: string; name: string; aliases: string[] }[];
};

export type AgentListItem = {
  slug: string;
  name: string;
  summary: string;
  category: string;
  tags: string[];
  pricing: Pricing | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  url: string;
};

export const LIST_TAGS_PER_ITEM = 5;

export function toListItem(r: AgentCatalogRow, origin: string): AgentListItem {
  return {
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    category: r.category.slug,
    tags: r.tags.slice(0, LIST_TAGS_PER_ITEM).map((t) => t.slug),
    pricing: r.pricingType === "unknown" ? null : r.pricingType,
    websiteUrl: r.websiteUrl,
    githubUrl: r.githubUrl,
    url: `${origin}/resources/${r.slug}`,
  };
}

/**
 * 筛选 + 排序 + 分页。
 * - category / tags / pricing 是硬条件；
 * - 有 query 且能分出有效词时，只返回命中的资源，按得分排序；否则按精选顺序 → 原顺序（仓储层按最近更新）。
 */
export function searchCatalog(rows: AgentCatalogRow[], p: SearchParams): { items: AgentCatalogRow[]; total: number; nextCursor: string | null } {
  let list = rows.filter(
    (r) =>
      (!p.category || r.category.slug === p.category) &&
      (!p.pricing || r.pricingType === p.pricing) &&
      (!p.tags?.length || p.tags.every((t) => r.tags.some((x) => x.slug === t))),
  );
  const q = p.query ? normalizeQuery(p.query) : "";
  const terms = q ? tokenize(q) : [];
  const byFeatured = (a: { r: AgentCatalogRow; i: number }, b: { r: AgentCatalogRow; i: number }) =>
    (a.r.featuredOrder ?? Infinity) - (b.r.featuredOrder ?? Infinity) || a.i - b.i;
  if (q && (terms.length > 0 || q.length >= 2)) {
    const scored = list
      .map((r, i) => ({ r, i, s: scoreItem({ ...r, tags: r.tags }, terms, q) + (r.slug === q ? 10 : 0) }))
      .filter((x) => x.s > 0);
    scored.sort((a, b) => b.s - a.s || byFeatured(a, b));
    list = scored.map((x) => x.r);
  } else {
    list = list.map((r, i) => ({ r, i })).sort(byFeatured).map((x) => x.r);
  }
  const offset = p.cursor ? Number(p.cursor) : 0;
  const items = list.slice(offset, offset + p.limit);
  const next = offset + items.length;
  return { items, total: list.length, nextCursor: next < list.length ? String(next) : null };
}

/** 查询串 → 核心服务入参：重复的 tag 合成数组，空值丢掉。 */
export function searchParamsToInput(sp: URLSearchParams) {
  const get = (k: string) => sp.get(k)?.trim() || undefined;
  const tags = [...sp.getAll("tag"), ...(sp.get("tags")?.split(",") ?? [])].map((t) => t.trim()).filter(Boolean);
  return {
    query: get("q") ?? get("query"),
    category: get("category"),
    tags: tags.length ? tags : undefined,
    pricing: get("pricing"),
    limit: get("limit"),
    cursor: get("cursor"),
  };
}
