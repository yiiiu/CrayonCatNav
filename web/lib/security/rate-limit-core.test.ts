import { describe, expect, it } from "vitest";
import { combine, decide, LOGIN_EMAIL, LOGIN_EMAIL_IP, LOGIN_IP, rateKey, retryText } from "./rate-limit-core";

const B = { name: "t", limit: 5, windowSec: 600 };

describe("限流 decide", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  const end = new Date("2026-10-29T12:04:30Z");

  it("未超过上限放行，remaining 递减", () => {
    expect(decide(B, 1, end, now)).toEqual({ ok: true, remaining: 4, retryAfterSec: 0 });
    expect(decide(B, 5, end, now)).toEqual({ ok: true, remaining: 0, retryAfterSec: 0 });
  });

  it("第 limit+1 次拒绝，retryAfter 为窗口剩余秒数（向上取整）", () => {
    expect(decide(B, 6, end, now)).toEqual({ ok: false, remaining: 0, retryAfterSec: 270 });
    expect(decide(B, 6, new Date(now.getTime() + 1500), now).retryAfterSec).toBe(2);
  });

  it("窗口已到期仍超限时至少等 1 秒", () => {
    expect(decide(B, 9, now, now).retryAfterSec).toBe(1);
  });
});

describe("限流 combine", () => {
  it("全部放行才放行", () => {
    expect(combine([{ ok: true, remaining: 1, retryAfterSec: 0 }, { ok: true, remaining: 3, retryAfterSec: 0 }])).toEqual({ ok: true, retryAfterSec: 0 });
  });
  it("任一超限即拒绝，等待取最长", () => {
    expect(
      combine([
        { ok: false, remaining: 0, retryAfterSec: 30 },
        { ok: true, remaining: 2, retryAfterSec: 0 },
        { ok: false, remaining: 0, retryAfterSec: 400 },
      ]),
    ).toEqual({ ok: false, retryAfterSec: 400 });
  });
  it("空列表放行", () => {
    expect(combine([])).toEqual({ ok: true, retryAfterSec: 0 });
  });
});

describe("限流 rateKey", () => {
  it("只含桶名与哈希，不含主体原文", () => {
    const k = rateKey(LOGIN_EMAIL_IP, "admin@example.com|198.51.100.7", "s3cret");
    expect(k).toMatch(/^login:email-ip:[0-9a-f]{32}$/);
    expect(k).not.toContain("admin");
    expect(k).not.toContain("198.51");
  });
  it("同主体同密钥稳定；换桶 / 换密钥 / 换主体都不同", () => {
    const a = rateKey(LOGIN_IP, "1.2.3.4", "s");
    expect(rateKey(LOGIN_IP, "1.2.3.4", "s")).toBe(a);
    expect(rateKey(LOGIN_EMAIL, "1.2.3.4", "s")).not.toBe(a);
    expect(rateKey(LOGIN_IP, "1.2.3.4", "t").split(":").pop()).not.toBe(a.split(":").pop());
    expect(rateKey(LOGIN_IP, "1.2.3.5", "s")).not.toBe(a);
  });
  it("缺少密钥时报错，不静默用空密钥", () => {
    expect(() => rateKey(LOGIN_IP, "x", "")).toThrow();
  });
});

describe("登录桶配置", () => {
  it("与规格一致", () => {
    expect([LOGIN_IP.limit, LOGIN_IP.windowSec]).toEqual([20, 600]);
    expect([LOGIN_EMAIL_IP.limit, LOGIN_EMAIL_IP.windowSec]).toEqual([5, 600]);
    expect([LOGIN_EMAIL.limit, LOGIN_EMAIL.windowSec]).toEqual([30, 3600]);
  });
  it("retryText 向上取整到分钟", () => {
    expect(retryText(1)).toBe("1 分钟");
    expect(retryText(61)).toBe("2 分钟");
    expect(retryText(600)).toBe("10 分钟");
  });
});
