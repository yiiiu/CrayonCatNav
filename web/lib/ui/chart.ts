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
