import { describe, expect, it } from "vitest";
import { buildSearchHref, parsePublicSearch, suggestSlug } from "./search";

describe("parsePublicSearch", () => {
  it("丢弃非法参数", () => {
    expect(parsePublicSearch({ q: "  mcp ", cat: "Bad Slug", tag: "stdio", page: "-3" })).toEqual({ q: "mcp", cat: undefined, tag: "stdio", page: 1 });
  });
  it("数组取首个、页码上限", () => {
    expect(parsePublicSearch({ cat: ["mcp", "x"], page: "9999" })).toMatchObject({ cat: "mcp", page: 1 });
  });
  it("关键词截断到 50 字", () => {
    expect(parsePublicSearch({ q: "a".repeat(80) }).q).toHaveLength(50);
  });
});

describe("buildSearchHref", () => {
  it("改筛选回到第 1 页", () => {
    expect(buildSearchHref({ q: "git", cat: "mcp", page: 3 }, { tag: "stdio" })).toBe("/resources?q=git&cat=mcp&tag=stdio");
  });
  it("翻页保留条件", () => {
    expect(buildSearchHref({ cat: "mcp" }, { page: 2 })).toBe("/resources?cat=mcp&page=2");
  });
  it("移除条件", () => {
    expect(buildSearchHref({ q: "git" }, { q: undefined })).toBe("/resources");
  });
});

describe("suggestSlug", () => {
  it("名称转 slug", () => {
    expect(suggestSlug("GitHub MCP Server")).toBe("github-mcp-server");
    expect(suggestSlug("蜡笔 Cat!")).toBe("cat");
  });
});
