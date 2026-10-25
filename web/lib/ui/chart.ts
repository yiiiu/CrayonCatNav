/** 图表用的小工具（纯函数）。 */

/** 取不小于 v 的「好看」刻度上限：1/2/2.5/5/10 × 10^n。 */
export function niceMax(v: number): number {
  if (!(v > 0)) return 1;
  const exp = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * exp >= v) return Math.max(1, m * exp);
  return 10 * exp;
}

/** 占比（0–100，保留整数），总数为 0 时返回 0。 */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** 千分位 */
export const fmt = (n: number) => new Intl.NumberFormat("zh-CN").format(Math.round(n));

/**
 * 把绘图区里的横坐标吸附到最近的数据点下标。
 * plotLeft / plotWidth 与绘图坐标同一单位；n 为点数。超出两端时夹到首尾。
 */
export function nearestIndex(px: number, plotLeft: number, plotWidth: number, n: number): number {
  if (n <= 1 || !(plotWidth > 0) || !Number.isFinite(px)) return 0;
  const t = (px - plotLeft) / plotWidth;
  return Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
}

/** 键盘移动选中点：左右逐个，Home/End 到两端；其他键返回 null。 */
export function stepIndex(key: string, current: number | null, n: number): number | null {
  if (n <= 0) return null;
  const cur = current ?? n - 1;
  switch (key) {
    case "ArrowLeft": return Math.max(0, cur - 1);
    case "ArrowRight": return Math.min(n - 1, cur + 1);
    case "Home": return 0;
    case "End": return n - 1;
    default: return null;
  }
}

const WEEK = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
/** "2026-10-25" → "10月25日 周日"（按日期本身计算，不受时区影响）。 */
export function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  if (!y || !m || !d) return date;
  const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${m}月${d}日 ${WEEK[w]}`;
}
