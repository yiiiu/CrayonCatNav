/** 搜索框实时过滤 / 联想用到的纯函数（便于单测）。 */

export const MAX_QUERY = 50;

/** 去首尾空白、折叠连续空白并截断到 50 字；空串返回 ""。 */
export function normalizeQuery(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

/**
 * 键盘在联想列表中移动高亮：-1 表示没有高亮（焦点仍在输入框）。
 * 向下从 -1 进入第一项，越过末项回到 -1；向上同理，循环往复。
 */
export function moveActive(count: number, current: number, dir: 1 | -1): number {
  if (count <= 0) return -1;
  const slots = count + 1; // 多出的一格代表「无高亮」
  const pos = (current + 1 + dir + slots) % slots;
  return pos - 1;
}

export type SuggestItem = { slug: string; name: string; summary: string; category: string };
export type SuggestResult = { q: string; total: number; items: SuggestItem[] };

/** 校验 /api/search 的响应形状，非法时视为无结果。 */
export function parseSuggest(data: unknown): SuggestResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.q !== "string" || typeof d.total !== "number" || !Array.isArray(d.items)) return null;
  const items = d.items.filter(
    (x): x is SuggestItem =>
      !!x && typeof x === "object" && ["slug", "name", "summary", "category"].every((k) => typeof (x as Record<string, unknown>)[k] === "string"),
  );
  return { q: d.q, total: d.total, items };
}
