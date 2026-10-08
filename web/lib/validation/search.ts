import { slugSchema } from "./common";

type Raw = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** 规范化前台列表的 URL 参数：非法值直接丢弃，不报错。 */
export function parsePublicSearch(raw: Raw) {
  const q = first(raw.q)?.trim().slice(0, 50) || undefined;
  const cat = slugSchema.safeParse(first(raw.cat)).success ? first(raw.cat) : undefined;
  const tag = slugSchema.safeParse(first(raw.tag)).success ? first(raw.tag) : undefined;
  const n = Number.parseInt(first(raw.page) ?? "1", 10);
  const page = Number.isFinite(n) && n >= 1 && n <= 500 ? n : 1;
  return { q, cat, tag, page };
}

/** 生成保留其余条件的列表链接；传 undefined 表示移除该条件，翻页外的改动都回到第 1 页。 */
export function buildSearchHref(
  current: { q?: string; cat?: string; tag?: string; page?: number },
  patch: Partial<{ q: string | undefined; cat: string | undefined; tag: string | undefined; page: number }>,
  base = "/resources",
) {
  const next = { ...current, ...patch };
  if (!("page" in patch)) next.page = 1;
  const sp = new URLSearchParams();
  if (next.q) sp.set("q", next.q);
  if (next.cat) sp.set("cat", next.cat);
  if (next.tag) sp.set("tag", next.tag);
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
