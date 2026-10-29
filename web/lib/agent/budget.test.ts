import { describe, expect, it } from "vitest";
import { budgetEnforced, checkBudget, costOf, monthRange } from "./budget";

const s = { prices: { input: 2, output: 8 }, monthlyBudget: 30, recommendShare: 50 };
const u = (promptTokens: number, completionTokens: number) => ({ calls: 1, promptTokens, completionTokens });

describe("花费折算", () => {
  it("按百万 token 单价折算", () => {
    expect(costOf(u(1_000_000, 500_000), s.prices)).toBe(6);
    expect(costOf(u(2500, 300), s.prices)).toBeCloseTo(0.0074, 4);
  });
  it("没填单价或上限为 0 时不限制", () => {
    expect(budgetEnforced({ ...s, prices: { input: 0, output: 0 } })).toBe(false);
    expect(budgetEnforced({ ...s, monthlyBudget: 0 })).toBe(false);
    expect(checkBudget("collect", { collect: u(1e9, 1e9) }, { ...s, prices: { input: 0, output: 0 } })).toEqual({ ok: true });
  });
});

describe("checkBudget", () => {
  it("总花费到上限后所有用途都停", () => {
    const usage = { collect: u(10_000_000, 1_250_000) }; // 20 + 10 = 30
    expect(checkBudget("collect", usage, s)).toEqual({ ok: false, reason: "monthly" });
    expect(checkBudget("recommend", usage, s)).toEqual({ ok: false, reason: "monthly" });
  });
  it("前台推荐超过占比上限只停推荐", () => {
    const usage = { recommend: u(5_000_000, 625_000) }; // 10 + 5 = 15 = 30 × 50%
    expect(checkBudget("recommend", usage, s)).toEqual({ ok: false, reason: "recommend_share" });
    expect(checkBudget("enrich", usage, s)).toEqual({ ok: true });
  });
  it("未到上限放行", () => {
    expect(checkBudget("recommend", { recommend: u(1000, 100), collect: u(1000, 100) }, s)).toEqual({ ok: true });
  });
});

describe("monthRange", () => {
  it("取所在自然月", () => {
    const r = monthRange(new Date("2026-12-31T00:00:00Z"));
    expect(r.start.toISOString()).toBe("2026-12-01T00:00:00.000Z");
    expect(r.end.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});
