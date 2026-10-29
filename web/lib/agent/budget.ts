/**
 * 模型花费上限的纯逻辑（规格 docs/spec/前台推荐Agent方案.md §5.2）。
 * 花费 = 输入 token × 输入单价 + 输出 token × 输出单价（元 / 百万 token），按当前单价折算整月用量。
 */

export const modelPurposes = ["recommend", "collect", "enrich", "term"] as const;
export type ModelPurpose = (typeof modelPurposes)[number];

export const purposeLabels: Record<ModelPurpose, string> = { recommend: "前台推荐", collect: "采集", enrich: "AI 补全", term: "AI 扩词" };

export type Usage = { calls: number; promptTokens: number; completionTokens: number };
export type Prices = { input: number; output: number };
export type BudgetSettings = { prices: Prices; monthlyBudget: number; recommendShare: number };

export const emptyUsage = (): Usage => ({ calls: 0, promptTokens: 0, completionTokens: 0 });

/** 用量折算金额（元），保留到分以下 4 位避免累加误差。 */
export function costOf(u: Pick<Usage, "promptTokens" | "completionTokens">, p: Prices): number {
  return Math.round(((u.promptTokens * p.input + u.completionTokens * p.output) / 1_000_000) * 10_000) / 10_000;
}

/** 没填单价时无法折算金额：只统计 token，不限制花费。 */
export function budgetEnforced(s: BudgetSettings): boolean {
  return s.monthlyBudget > 0 && (s.prices.input > 0 || s.prices.output > 0);
}

export type BudgetCheck = { ok: true } | { ok: false; reason: "monthly" | "recommend_share" };

/**
 * 调用前检查：本月总花费达到上限则所有用途都停；前台推荐另有占比上限，防止访客用光采集额度。
 */
export function checkBudget(purpose: ModelPurpose, usage: Partial<Record<ModelPurpose, Usage>>, s: BudgetSettings): BudgetCheck {
  if (!budgetEnforced(s)) return { ok: true };
  const total = modelPurposes.reduce((sum, k) => sum + costOf(usage[k] ?? emptyUsage(), s.prices), 0);
  if (total >= s.monthlyBudget) return { ok: false, reason: "monthly" };
  if (purpose === "recommend") {
    const rec = costOf(usage.recommend ?? emptyUsage(), s.prices);
    if (rec >= (s.monthlyBudget * s.recommendShare) / 100) return { ok: false, reason: "recommend_share" };
  }
  return { ok: true };
}

/** 统计日（UTC 零点对齐的北京时间自然日）所在月的 [月初, 下月初)。 */
export function monthRange(day: Date): { start: Date; end: Date } {
  const y = day.getUTCFullYear();
  const m = day.getUTCMonth();
  return { start: new Date(Date.UTC(y, m, 1)), end: new Date(Date.UTC(y, m + 1, 1)) };
}

/** 金额显示：¥12.34；不足 1 分显示 ¥0.00。 */
export const yuan = (n: number) => `¥${n.toFixed(2)}`;
