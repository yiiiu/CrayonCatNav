/**
 * 前台推荐的粗筛（不调模型，规格 docs/spec/前台推荐Agent方案.md §3.1）。
 * 资源在几百条以内，直接在内存里给每条打分，取前 N 个交给模型；命中不足时用精选 / 最近更新补齐。
 */

export type CatalogItem = {
  slug: string;
  name: string;
  summary: string;
  category: { slug: string; name: string };
  tags: { name: string; aliases: string[] }[];
  /** 精选顺序（越小越靠前），非精选为 null */
  featuredOrder: number | null;
};

const STOPWORDS = new Set(
  "的 了 和 与 及 或 我 你 他 她 它 我们 想 要 想要 需要 一个 一些 什么 怎么 如何 哪个 哪些 有没有 有 没有 可以 能 能够 用 用来 使用 帮 帮我 给 让 把 被 在 是 不 很 吗 呢 吧 啊 做 找 推荐 工具 一下 东西 好用 好的 the a an to for of and or with my me i want need tool tools app use using best good".split(
    " ",
  ),
);

const segmenter = new Intl.Segmenter("zh", { granularity: "word" });

/** 规范化：去首尾空白、合并空白、转小写。 */
export function normalizeQuery(q: string): string {
  return q.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

/** 分词：中文按词，英文按单词；去停用词、去单字（英文单字母、中文单字信息量太低）。 */
export function tokenize(q: string): string[] {
  const out = new Set<string>();
  for (const s of segmenter.segment(normalizeQuery(q))) {
    if (!s.isWordLike) continue;
    const w = s.segment.trim();
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    out.add(w);
  }
  return [...out];
}

const W = { tag: 3, name: 3, category: 2, summary: 1 } as const;

/**
 * 单条资源得分：每个字段只按命中与否计一次分。
 * 除了「词出现在字段里」，也算「标签 / 名称整体出现在原句里」，弥补分词切错（如「做PPT的AI」）。
 */
export function scoreItem(item: CatalogItem, terms: string[], normalizedQuery: string): number {
  const name = item.name.toLowerCase();
  const tagWords = item.tags.flatMap((t) => [t.name, ...t.aliases]).map((w) => w.toLowerCase()).filter((w) => w.length >= 2);
  const cat = item.category.name.toLowerCase();
  const summary = item.summary.toLowerCase();
  const hit = (field: string) => terms.some((t) => field.includes(t));
  let score = 0;
  if (tagWords.some((w) => normalizedQuery.includes(w)) || terms.some((t) => tagWords.some((w) => w.includes(t)))) score += W.tag;
  if ((name.length >= 2 && normalizedQuery.includes(name)) || hit(name)) score += W.name;
  if (hit(cat)) score += W.category;
  if (hit(summary)) score += W.summary;
  return score;
}

/** 排序：得分高的在前；同分按精选顺序，再按原顺序（仓储层已按最近更新排）。 */
export function prefilter(items: CatalogItem[], q: string, limit = 30): { items: CatalogItem[]; matched: number } {
  const nq = normalizeQuery(q);
  const terms = tokenize(q);
  const scored = items.map((item, i) => ({ item, i, score: scoreItem(item, terms, nq) }));
  scored.sort((a, b) => b.score - a.score || (a.item.featuredOrder ?? Infinity) - (b.item.featuredOrder ?? Infinity) || a.i - b.i);
  return { items: scored.slice(0, limit).map((s) => s.item), matched: scored.filter((s) => s.score > 0).length };
}
