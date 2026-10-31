import { describe, expect, it } from "vitest";
import { describeIssues, resourceInput, searchCatalog, searchInput, searchParamsToInput, toListItem, type AgentCatalogRow } from "./core";

const row = (slug: string, name: string, summary: string, cat: string, tags: string[] = [], pricingType: AgentCatalogRow["pricingType"] = "free", featuredOrder: number | null = null): AgentCatalogRow => ({
  slug,
  name,
  summary,
  websiteUrl: `https://${slug}.dev`,
  githubUrl: null,
  pricingType,
  featuredOrder,
  category: { slug: cat, name: cat === "ui-components" ? "UI 组件库" : "MCP 服务" },
  tags: tags.map((t) => ({ slug: t, name: t, aliases: [] })),
});

const rows = [
  row("shadcn-ui", "shadcn/ui", "可复制进项目的 React 组件", "ui-components", ["react", "tailwind"]),
  row("radix", "Radix UI", "无样式、可访问的 React 组件原语", "ui-components", ["react", "headless"], "free", 1),
  row("mui", "MUI", "Material Design 风格的 React 组件库", "ui-components", ["react"], "freemium"),
  row("vuetify", "Vuetify", "Vue 组件库", "ui-components", ["vue"]),
  row("mcp-github", "GitHub MCP", "让模型操作 GitHub", "mcp", ["github"]),
];

const parse = (v: unknown) => searchInput.parse(v);

describe("searchCatalog", () => {
  it("无条件时按精选优先、其余保持原顺序", () => {
    const r = searchCatalog(rows, parse({}));
    expect(r.items.map((x) => x.slug)).toEqual(["radix", "shadcn-ui", "mui", "vuetify", "mcp-github"]);
    expect(r.total).toBe(5);
    expect(r.nextCursor).toBeNull();
  });
  it("分类 / 标签 / 价格是硬条件", () => {
    expect(searchCatalog(rows, parse({ category: "ui-components", tags: ["react"], pricing: "free" })).items.map((x) => x.slug)).toEqual(["radix", "shadcn-ui"]);
    expect(searchCatalog(rows, parse({ tags: ["react", "headless"] })).items.map((x) => x.slug)).toEqual(["radix"]);
  });
  it("有关键词时只返回命中的", () => {
    const r = searchCatalog(rows, parse({ category: "ui-components", query: "vue" }));
    expect(r.items.map((x) => x.slug)).toEqual(["vuetify"]);
  });
  it("关键词等于 slug 时排第一", () => {
    expect(searchCatalog(rows, parse({ query: "mui" })).items[0].slug).toBe("mui");
  });
  it("分页", () => {
    const p1 = searchCatalog(rows, parse({ limit: 2 }));
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBe("2");
    const p3 = searchCatalog(rows, parse({ limit: 2, cursor: "4" }));
    expect(p3.items.map((x) => x.slug)).toEqual(["mcp-github"]);
    expect(p3.nextCursor).toBeNull();
  });
});

describe("入参校验", () => {
  it("limit 字符串会转数字，超范围报错", () => {
    expect(parse({ limit: "5" }).limit).toBe(5);
    expect(parse({}).limit).toBe(10);
    const bad = searchInput.safeParse({ limit: 99 });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(describeIssues(bad.error)).toContain("limit");
  });
  it("slug 规范化为小写，非法字符报错", () => {
    expect(resourceInput.parse({ slug: " Radix " }).slug).toBe("radix");
    expect(resourceInput.safeParse({ slug: "../etc" }).success).toBe(false);
    expect(searchInput.safeParse({ pricing: "cheap" }).success).toBe(false);
    expect(searchInput.safeParse({ tags: ["a", "b", "c", "d", "e", "f"] }).success).toBe(false);
  });
  it("查询串转换：tag 可重复或逗号分隔，空值丢弃", () => {
    const sp = new URLSearchParams("q=react&tag=a&tag=b&tags=c,%20d&category=&limit=3");
    expect(searchParamsToInput(sp)).toEqual({ query: "react", category: undefined, tags: ["a", "b", "c", "d"], pricing: undefined, limit: "3", cursor: undefined });
  });
});

describe("toListItem", () => {
  it("精简字段、标签最多 5 个、unknown 价格为 null、带站内链接", () => {
    const r = { ...row("x", "X", "s", "mcp", ["a", "b", "c", "d", "e", "f"]), pricingType: "unknown" as const };
    const it = toListItem(r, "https://example.com");
    expect(it.tags).toHaveLength(5);
    expect(it.pricing).toBeNull();
    expect(it.url).toBe("https://example.com/resources/x");
    expect(it.category).toBe("mcp");
  });
});
