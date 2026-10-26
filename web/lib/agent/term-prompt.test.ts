import { describe, expect, it } from "vitest";
import { buildDescriptionPrompt, buildTermPrompt, parseDescriptionOutput, type TermContext } from "./term-prompt";

const ctx: TermContext = {
  category: { slug: "rag-knowledge", name: "RAG 与知识库", description: "检索增强生成" },
  samples: [{ name: "LlamaIndex", summary: "数据框架", tags: ["RAG"] }],
  current: { githubTopics: ["rag"], githubKeywords: [], hfSearch: [] },
  others: [{ name: "MCP 服务", description: "MCP 相关", terms: { githubTopics: ["mcp-server"], githubKeywords: [], hfSearch: [] } }],
};

describe("扩词提示词", () => {
  it("包含分类语境、样例、已有词、其他分类同字段词与格式要求", () => {
    const p = buildTermPrompt(ctx, "githubTopics", 10);
    expect(p).toContain("rag-knowledge: RAG 与知识库");
    expect(p).toContain("LlamaIndex：数据框架（RAG）");
    expect(p).toContain("GitHub 主题：rag");
    expect(p).toContain("MCP 服务：mcp-server");
    expect(p).toContain("推荐 10 个新的GitHub 主题");
    expect(p).toContain('{"terms"');
  });
  it("分类说明提示词带其他分类说明；输出截到 500 字", () => {
    expect(buildDescriptionPrompt(ctx)).toContain("MCP 服务：MCP 相关");
    expect(parseDescriptionOutput({ description: "x".repeat(600) })).toHaveLength(500);
    expect(parseDescriptionOutput({})).toBe("");
  });
});
