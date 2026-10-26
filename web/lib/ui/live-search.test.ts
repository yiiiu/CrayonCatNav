import { describe, expect, it } from "vitest";
import { moveActive, normalizeQuery, parseSuggest } from "./live-search";

describe("normalizeQuery", () => {
  it("去空白并折叠", () => expect(normalizeQuery("  mcp   server ")).toBe("mcp server"));
  it("空值", () => {
    expect(normalizeQuery(null)).toBe("");
    expect(normalizeQuery("   ")).toBe("");
  });
  it("截断到 50 字", () => expect(normalizeQuery("a".repeat(80))).toHaveLength(50));
});

describe("moveActive", () => {
  it("向下进入第一项并循环回输入框", () => {
    expect(moveActive(3, -1, 1)).toBe(0);
    expect(moveActive(3, 2, 1)).toBe(-1);
  });
  it("向上从输入框到末项", () => {
    expect(moveActive(3, -1, -1)).toBe(2);
    expect(moveActive(3, 0, -1)).toBe(-1);
  });
  it("空列表", () => expect(moveActive(0, -1, 1)).toBe(-1));
});

describe("parseSuggest", () => {
  it("过滤非法条目", () => {
    const r = parseSuggest({ q: "a", total: 2, items: [{ slug: "x", name: "X", summary: "", category: "MCP" }, { slug: 1 }] });
    expect(r?.items).toHaveLength(1);
  });
  it("非法响应", () => {
    expect(parseSuggest(null)).toBeNull();
    expect(parseSuggest({ q: "a" })).toBeNull();
  });
});
