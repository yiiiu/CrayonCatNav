import { describe, expect, it } from "vitest";
import { httpsUrlSchema, slugSchema } from "./common";

describe("slugSchema", () => {
  it.each(["mcp", "github-mcp", "a1-b2"])("接受 %s", (s) => expect(slugSchema.safeParse(s).success).toBe(true));
  it.each(["A", "a", "with space", "-lead", "trail-", "a--b", "中文"])("拒绝 %s", (s) =>
    expect(slugSchema.safeParse(s).success).toBe(false),
  );
});

describe("httpsUrlSchema", () => {
  it("接受 https", () => expect(httpsUrlSchema.safeParse("https://modelcontextprotocol.io").success).toBe(true));
  it.each(["http://example.com", "javascript:alert(1)", "ftp://x.y", "not a url"])("拒绝 %s", (u) =>
    expect(httpsUrlSchema.safeParse(u).success).toBe(false),
  );
});
