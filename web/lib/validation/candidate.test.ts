import { describe, expect, it } from "vitest";
import { candidateReviewSchema, cleanModelOutput, extractJson, splitTagEntries } from "./candidate";
import { buildVocab } from "./tag-vocab";

const ctx = {
  categorySlugs: ["mcp", "ai-coding", "github-oss"],
  tags: buildVocab([
    { name: "数据库", slug: "database" },
    { name: "开源", slug: "open-source" },
    { name: "LangChain", slug: "langchain" },
  ]),
  toolSlugs: ["mcp-config", "token-cost"],
};
const raw = { githubUrl: "https://github.com/Acme/pg-mcp", websiteUrl: "https://pg-mcp.dev/" };

const good = {
  name: "PG MCP",
  slug: "PG MCP Server",
  summary: "让 AI 助手通过 MCP 安全查询 PostgreSQL 的开源服务。",
  description: "第一段。\n\n第二段。",
  categorySlug: "mcp",
  tags: ["数据库", "#开源", "langchain", "Postgres", "数据库", "这是一个特别特别特别特别特别特别长的标签名字"],
  websiteUrl: "https://pg-mcp.dev/",
  githubUrl: "https://github.com/evil/other",
  pricingType: "free",
  toolSlugs: ["mcp-config", "not-a-tool"],
  reason: "官方维护，star 增长快。",
  confidence: "0.876",
};

describe("cleanModelOutput", () => {
  it("合格输出：slug 规范化、只保留现有标签、工具只留注册表内、链接只用来源给的", () => {
    const r = cleanModelOutput(good, raw, ctx);
    expect(r.ok && !r.skip).toBe(true);
    if (!r.ok || r.skip) return;
    expect(r.payload.slug).toBe("pg-mcp-server");
    expect(r.payload.tags).toEqual(["数据库", "开源", "LangChain"]); // 「Postgres」不是现有标签，丢弃
    expect(r.payload.suggestedTags).toEqual([]);
    expect(r.payload.toolSlugs).toEqual(["mcp-config"]);
    expect(r.payload.githubUrl).toBe("https://github.com/Acme/pg-mcp"); // 模型给的 evil/other 被忽略
    expect(r.payload.websiteUrl).toBe("https://pg-mcp.dev/");
    expect(r.payload.pricingType).toBe("free");
    expect(r.confidence).toBe(0.88);
  });

  it("模型可用 null 去掉不相关的链接，但不能全部去掉", () => {
    const r = cleanModelOutput({ ...good, websiteUrl: null }, raw, ctx);
    expect(r.ok && !r.skip && r.payload.websiteUrl).toBe(null);
    const none = cleanModelOutput({ ...good, websiteUrl: null, githubUrl: null }, raw, ctx);
    expect(none.ok).toBe(false);
  });

  it("来源的 http 官网不会进入结果；官网与 GitHub 相同则只留 GitHub", () => {
    const r = cleanModelOutput(good, { githubUrl: null, websiteUrl: "http://insecure.dev" }, ctx);
    expect(r.ok).toBe(false);
    const same = cleanModelOutput(good, { githubUrl: "https://github.com/a/b", websiteUrl: "https://github.com/a/b/" }, ctx);
    expect(same.ok && !same.skip && same.payload.websiteUrl).toBe(null);
  });

  it("分类不在现有列表时报错（用于让模型重试）", () => {
    const r = cleanModelOutput({ ...good, categorySlug: "made-up" }, raw, ctx);
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("categorySlug");
  });

  it("summary 必须是中文且不超过 200 字；confidence 必须在 0–1", () => {
    expect(cleanModelOutput({ ...good, summary: "An English summary" }, raw, ctx).ok).toBe(false);
    expect(cleanModelOutput({ ...good, summary: "中".repeat(201) }, raw, ctx).ok).toBe(false);
    expect(cleanModelOutput({ ...good, confidence: 1.5 }, raw, ctx).ok).toBe(false);
    expect(cleanModelOutput({ ...good, reason: "" }, raw, ctx).ok).toBe(false);
  });

  it("未知定价归为 unknown；slug 为中文时退回仓库名", () => {
    const r = cleanModelOutput({ ...good, pricingType: "maybe", slug: "数据库服务", name: "数据库助手" }, raw, ctx);
    expect(r.ok && !r.skip && r.payload.pricingType).toBe("unknown");
    expect(r.ok && !r.skip && r.payload.slug).toBe("pg-mcp");
  });

  it("模型可以建议跳过", () => {
    expect(cleanModelOutput({ skip: true, reason: "与 AI 无关" }, raw, ctx)).toEqual({ ok: true, skip: true, reason: "与 AI 无关" });
  });

  it("结构完全不对时给出字段名", () => {
    const r = cleanModelOutput({ foo: 1 }, raw, ctx);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/name|summary|categorySlug|reason|confidence/);
  });
});

describe("extractJson", () => {
  it("支持纯 JSON、代码块包裹与前后带文字", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
    expect(extractJson('```json\n{"a":2}\n```')).toEqual({ a: 2 });
    expect(extractJson('好的：{"a":3} 以上')).toEqual({ a: 3 });
    expect(() => extractJson("not json")).toThrow();
  });
});

describe("cleanModelOutput 的建议标签", () => {
  it("合法建议进入 suggestedTags，命中现有标签的并入 tags", () => {
    const r = cleanModelOutput(
      { ...good, tags: ["数据库"], suggestedTags: [{ name: "向量检索", slug: "Vector-Search" }, { name: "开源", slug: "oss" }] },
      raw,
      ctx,
    );
    expect(r.ok && !r.skip).toBe(true);
    if (!r.ok || r.skip) return;
    expect(r.payload.tags).toEqual(["数据库", "开源"]);
    expect(r.payload.suggestedTags).toEqual([{ name: "向量检索", slug: "vector-search" }]);
  });
  it("旧格式的 payload 没有 suggestedTags 时默认为空", async () => {
    const { candidatePayloadSchema } = await import("./candidate");
    const p = candidatePayloadSchema.parse({ name: "a", slug: "a", summary: "s", description: "", categorySlug: "mcp", tags: [], websiteUrl: null, githubUrl: null, pricingType: "free", toolSlugs: [] });
    expect(p.suggestedTags).toEqual([]);
  });
});

describe("candidateReviewSchema", () => {
  it("标签支持中英文逗号、顿号与换行", () => {
    const r = candidateReviewSchema.parse({ name: "A", slug: "a", summary: "简介", categorySlug: "mcp", tags: "数据库，开源,MCP、 搜索\n记忆管理" });
    expect(r.tags.map((t) => t.name)).toEqual(["数据库", "开源", "MCP", "搜索", "记忆管理"]);
  });
  it("新标签写成「名字:slug」，拆成 tags 与 suggestedTags", () => {
    const r = candidateReviewSchema.parse({ name: "A", slug: "a", summary: "简介", categorySlug: "mcp", tags: "数据库，视频剪辑:video-editing，AI绘画：AI-Painting" });
    expect(splitTagEntries(r.tags)).toEqual({
      tags: ["数据库"],
      suggestedTags: [
        { name: "视频剪辑", slug: "video-editing" },
        { name: "AI绘画", slug: "ai-painting" },
      ],
    });
  });
  it("简介超长报错", () => {
    expect(candidateReviewSchema.safeParse({ name: "A", slug: "a", summary: "中".repeat(201), categorySlug: "mcp", tags: "" }).success).toBe(false);
  });
});
