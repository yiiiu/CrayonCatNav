import { describe, expect, it } from "vitest";
import { hitLoginLimit, resetLoginLimit } from "./rate-limit";

describe("登录限流", () => {
  it("10 分钟内第 6 次起被拦截，重置后恢复", () => {
    const key = "a@b.c";
    const t = 1_000;
    for (let i = 0; i < 5; i++) expect(hitLoginLimit(key, t)).toBe(false);
    expect(hitLoginLimit(key, t)).toBe(true);
    resetLoginLimit(key);
    expect(hitLoginLimit(key, t)).toBe(false);
  });

  it("窗口过期后重新计数", () => {
    const key = "x@y.z";
    for (let i = 0; i < 6; i++) hitLoginLimit(key, 0);
    expect(hitLoginLimit(key, 10 * 60 * 1000 + 1)).toBe(false);
  });
});
