import { describe, expect, it } from "vitest";
import { clientIp, newSalt, visitorHash } from "./visitor";

describe("访客哈希", () => {
  const ip = "203.0.113.7";
  const ua = "Mozilla/5.0 (iPhone)";
  it("同盐同访客稳定、长度 32", () => {
    const a = visitorHash("salt-1", ip, ua);
    expect(a).toBe(visitorHash("salt-1", ip, ua));
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it("换盐（换天）后无法关联", () => expect(visitorHash("salt-1", ip, ua)).not.toBe(visitorHash("salt-2", ip, ua)));
  it("IP 或 UA 不同即不同访客", () => {
    expect(visitorHash("s", ip, ua)).not.toBe(visitorHash("s", "203.0.113.8", ua));
    expect(visitorHash("s", ip, ua)).not.toBe(visitorHash("s", ip, `${ua} x`));
  });
  it("哈希中不含 IP / UA 原文", () => {
    const h = visitorHash("s", ip, ua);
    expect(h).not.toContain("203");
    expect(h).not.toContain("iPhone");
  });
  it("盐是随机的 64 位十六进制", () => {
    const s = newSalt();
    expect(s).toMatch(/^[0-9a-f]{64}$/);
    expect(s).not.toBe(newSalt());
  });
  it("clientIp 取 x-forwarded-for 第一个", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "198.51.100.1, 10.0.0.1" }))).toBe("198.51.100.1");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("");
  });
});
