import { slugSchema } from "./common";
import { platforms, type Platform } from "./resource-details";

/** 列表排序：默认推荐（精选优先、最近更新），最新收录，近 30 天热门。 */
export const SORTS = ["new", "hot"] as const;
export type Sort = (typeof SORTS)[number];
export const sortLabels: Record<Sort | "default", string> = { default: "推荐", new: "最新", hot: "热门" };

/** 定价筛选（unknown 不作为筛选项）。 */
export const PRICES = ["free", "freemium", "paid"] as const;
export type Price = (typeof PRICES)[number];

export type PublicSearchParams = { q?: string; cat?: string; tag?: string; sort?: Sort; price?: Price; platform?: Platform; page?: number };

const oneOf = <T extends string>(list: readonly T[], v: string | undefined): T | undefined =>
  v !== undefined && (list as readonly string[]).includes(v) ? (v as T) : undefined;

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 规范化前台列表的 URL 参数：非法值直接丢弃，不报错。 */
export function parsePublicSearch(raw: Raw) {
  const q = first(raw.q)?.trim().slice(0, 50) || undefined;
  const cat = slugSchema.safeParse(first(raw.cat)).success ? first(raw.cat) : undefined;
  const tag = slugSchema.safeParse(first(raw.tag)).success ? first(raw.tag) : undefined;
  const n = Number.parseInt(first(raw.page) ?? "1", 10);
  const page = Number.isFinite(n) && n >= 1 && n <= 500 ? n : 1;
  const sort = oneOf(SORTS, first(raw.sort));
  const price = oneOf(PRICES, first(raw.price));
  const platform = oneOf(platforms, first(raw.platform));
  return { q, cat, tag, sort, price, platform, page };
}

/** 生成保留其余条件的列表链接；传 undefined 表示移除该条件，翻页外的改动都回到第 1 页。 */
export function buildSearchHref(
  current: PublicSearchParams,
  patch: { [K in keyof PublicSearchParams]?: PublicSearchParams[K] | undefined },
  base = "/resources",
) {
  const next = { ...current, ...patch };
  if (!("page" in patch)) next.page = 1;
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.cat) sp.set("cat", next.cat);
  if (next.tag) sp.set("tag", next.tag);
  if (next.sort) sp.set("sort", next.sort);
  if (next.price) sp.set("price", next.price);
  if (next.platform) sp.set("platform", next.platform);
  if (next.page && next.page > 1) sp.set("page", String(next.page));
  const qs = sp.toString();
  return qs ? `${base}?${qs}` : base;
}

/** 由名称生成 slug 建议（仅保留 ASCII 字母数字）。 */
export function suggestSlug(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}
