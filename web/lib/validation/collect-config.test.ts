import { describe, expect, it } from "vitest";
import { collectConfigFromForm, collectConfigSchema, DEFAULT_COLLECT_CONFIGS, parseStoredConfig } from "./collect-config";

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("分类采集配置校验", () => {
  it("默认配置都能通过校验，且每个都有分类说明", () => {
    expect(Object.keys(DEFAULT_COLLECT_CONFIGS).sort()).toEqual(["agent-frameworks", "agent-skills", "ai-coding", "ai-creation", "github-oss", "llmops", "local-llm", "mcp", "models-api", "rag-knowledge", "ui-components"]);
    for (const [slug, c] of Object.entries(DEFAULT_COLLECT_CONFIGS)) {
      const r = collectConfigSchema.safeParse(c);
      expect(r.success, slug).toBe(true);
      expect(c.description.length).toBeGreaterThan(10);
    }
    expect(DEFAULT_COLLECT_CONFIGS.mcp.sources).toMatchObject({ mcpRegistry: true, awesome: true });
  });
  it("表单解析：主题按逗号/空格分隔并转小写去重，关键词保留空格", () => {
    const raw = collectConfigFromForm(
      fd({ enabled: "on", src_github: "on", src_huggingface: "on", githubTopics: "MCP-Server，mcp-server  rag", githubKeywords: "ai code review, llm gateway", githubMinStars: "800", hfSearch: "image video", description: " 说明 " }),
    );
    const r = collectConfigSchema.parse(raw);
    expect(r.githubTopics).toEqual(["mcp-server", "rag"]);
    expect(r.githubKeywords).toEqual(["ai code review", "llm gateway"]);
    expect(r.githubMinStars).toBe(800);
    expect(r.githubNewMinStars).toBe(100);
    expect(r.hfSearch).toEqual(["image", "video"]);
    expect(r.sources).toEqual({ github: true, mcpRegistry: false, awesome: false, huggingface: true, productHunt: false });
    expect(r.description).toBe("说明");
  });
  it("开启 GitHub 但没有主题和关键词时报错", () => {
    const r = collectConfigSchema.safeParse(collectConfigFromForm(fd({ enabled: "on", src_github: "on" })));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["githubTopics"]);
  });
  it("参与采集时至少开一个来源；关闭的分类可以不开", () => {
    expect(collectConfigSchema.safeParse(collectConfigFromForm(fd({ enabled: "on" }))).error?.issues[0].path).toEqual(["sources"]);
    expect(collectConfigSchema.safeParse(collectConfigFromForm(fd({}))).success).toBe(true);
  });
  it("拒绝会破坏查询语法的主题、关键词与 HF 搜索词", () => {
    const base = { enabled: true, sources: { github: true } };
    expect(collectConfigSchema.safeParse({ ...base, githubTopics: ["mcp server"] }).success).toBe(false);
    expect(collectConfigSchema.safeParse({ ...base, githubTopics: ["x"], githubKeywords: ['a" stars:>0'] }).success).toBe(false);
    expect(collectConfigSchema.safeParse({ ...base, githubTopics: ["x"], hfSearch: ["a b"] }).success).toBe(false);
    expect(collectConfigSchema.safeParse({ ...base, githubTopics: ["x"], githubMinStars: -1 }).success).toBe(false);
    expect(collectConfigSchema.safeParse({ ...base, githubTopics: Array.from({ length: 9 }, (_, i) => `t${i}`) }).success).toBe(false);
  });
  it("库里的配置不合法时视为未配置", () => {
    expect(parseStoredConfig(null)).toBeNull();
    expect(parseStoredConfig({ enabled: true, sources: { github: true } })).toBeNull();
    expect(parseStoredConfig(DEFAULT_COLLECT_CONFIGS["ai-creation"])?.hfSearch).toContain("image");
  });
});
