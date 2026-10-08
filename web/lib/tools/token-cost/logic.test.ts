import { describe, expect, it } from "vitest";
import { estimate, formatMoney, formula, type CostRaw } from "./logic";

const raw = (o: Partial<CostRaw> = {}): CostRaw => ({ inPrice: "3", outPrice: "15", inTokens: "1200", outTokens: "800", requests: "1000", ...o });

function ok(r: ReturnType<typeof estimate>) {
  if (!r.ok) throw new Error(`期望成功：${JSON.stringify(r.errors)}`);
  return r;
}

describe("Token 成本估算", () => {
  it("常见输入：与原型示例一致", () => {
    const r = ok(estimate(raw()));
    expect(r.perRequest).toBeCloseTo(0.0156, 10);
    expect(r.total).toBeCloseTo(15.6, 10);
    expect(formatMoney(r.perRequest, "USD")).toBe("$0.0156");
    expect(formatMoney(r.total, "USD")).toBe("$15.6000");
    expect(formula(r, raw(), "USD")).toBe("(1,200 × 3 + 800 × 15) ÷ 1,000,000 = $0.0156\n× 1,000 次 = $15.6000");
  });

  it("全零：结果为 0", () => {
    const r = ok(estimate(raw({ inPrice: "0", outPrice: "0", inTokens: "0", outTokens: "0", requests: "0" })));
    expect(r.total).toBe(0);
    expect(formatMoney(r.total, "CNY")).toBe("¥0.0000");
  });

  it("非常小的单价：无浮点误差，展示为 < 0.0001", () => {
    const r = ok(estimate(raw({ inPrice: "0.000001", outPrice: "0", inTokens: "1", outTokens: "0", requests: "1" })));
    expect(r.perRequest).toBe(1e-12);
    expect(formatMoney(r.perRequest, "USD")).toBe("< $0.0001");
  });

  it("小数单价累加精确（0.1 + 0.2 场景）", () => {
    const r = ok(estimate(raw({ inPrice: "0.1", outPrice: "0.2", inTokens: "1000000", outTokens: "1000000", requests: "1" })));
    expect(r.total).toBe(0.3);
  });

  it("大 Token 量与多次请求", () => {
    const r = ok(estimate(raw({ inPrice: "2.5", outPrice: "10", inTokens: "1000000000", outTokens: "500000000", requests: "1000" })));
    expect(r.perRequest).toBe(7500);
    expect(r.total).toBe(7_500_000);
    expect(formatMoney(r.total, "EUR")).toBe("€7,500,000.0000");
  });

  it("四舍五入为 half-up", () => {
    expect(formatMoney(0.00005, "USD")).toBe("$0.0001");
    expect(formatMoney(1.23455, "USD")).toBe("$1.2346");
  });

  it("非法负数、小数 Token、空必填被拒绝", () => {
    const r = estimate(raw({ inTokens: "-100", requests: "", outTokens: "1.5", inPrice: "abc" }));
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.inTokens).toBe("请输入 ≥ 0 的整数");
    expect(r.errors.requests).toBe("必填");
    expect(r.errors.outTokens).toBe("请输入 ≥ 0 的整数");
    expect(r.errors.inPrice).toBe("请输入 ≥ 0 的数字");
  });

  it("千分位逗号可输入；超上限被拒绝", () => {
    expect(ok(estimate(raw({ inTokens: "1,200" }))).values.inTokens).toBe(1200);
    expect(estimate(raw({ requests: "10000000000" })).ok).toBe(false);
  });

  it("输出 Token 可留空视为 0", () => {
    expect(ok(estimate(raw({ outTokens: "" }))).perRequest).toBeCloseTo(0.0036, 10);
  });
});
