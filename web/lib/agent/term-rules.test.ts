import { describe, expect, it } from "vitest";
import { applyHits, candidateCap, classifyTerms, finalizeTerms, normalizeTerm, parseTermOutput, splitFieldValue, termKey, type ClassifiedTerm } from "./term-rules";

const c = (term: string) => ({ term, meaning: "m", reason: "r" });

describe("扩词规则：归一化", () => {
  it("termKey 忽略大小写、空格、连字符、下划线和点", () => {
    expect(termKey("MCP Server")).toBe(termKey("mcp-server"));
    expect(termKey("mcp_server")).toBe("mcpserver");
    expect(termKey("llama.cpp")).toBe("llamacpp");
  });
  it("按字段整理写法并复用表单校验", () => {
    expect(normalizeTerm("githubTopics", " Text To Image ")).toBe("text-to-image");
    expect(normalizeTerm("githubTopics", "#mcp_server")).toBe("mcp-server");
    expect(normalizeTerm("githubTopics", "中文主题")).toBeNull();
    expect(normalizeTerm("githubKeywords", "ai   code review")).toBe("ai code review");
    expect(normalizeTerm("githubKeywords", "a")).toBeNull();
    expect(normalizeTerm("hfSearch", "llama.cpp")).toBe("llama.cpp");
    expect(normalizeTerm("hfSearch", "two words")).toBeNull();
  });
  it("拆分输入框：关键词保留空格", () => {
    expect(splitFieldValue("githubTopics", "a-b, c d，e")).toEqual(["a-b", "c", "d", "e"]);
    expect(splitFieldValue("githubKeywords", "ai code review, llm gateway")).toEqual(["ai code review", "llm gateway"]);
  });
});

describe("扩词规则：分类", () => {
  const ctx = { field: "githubTopics" as const, existing: ["mcp-server"], others: [{ name: "AI 编程", terms: ["coding-agent"] }] };
  it("丢掉不合法与重复的，标出泛词、已存在、跨分类重复", () => {
    const r = classifyTerms([c("Agent Framework"), c("agent_framework"), c("中文"), c("LLM"), c("MCP Server"), c("coding agent"), c("multi-agent")], ctx);
    expect(r.map((t) => [t.term, t.status])).toEqual([
      ["agent-framework", "ok"],
      ["llm", "blocked"],
      ["mcp-server", "blocked"],
      ["coding-agent", "blocked"],
      ["multi-agent", "ok"],
    ]);
    expect(r[3].note).toContain("AI 编程");
    expect(r[0].hits).toBeNull();
  });
  it("命中数：0 不可用，超过 2 万过泛，HF 不判过泛，null 为未校验", () => {
    const t: ClassifiedTerm = { ...c("x"), status: "ok", note: "", hits: null };
    expect(applyHits(t, 0, "githubTopics").status).toBe("blocked");
    expect(applyHits(t, 25_000, "githubTopics").status).toBe("broad");
    expect(applyHits(t, 1_240, "githubTopics")).toMatchObject({ status: "ok", hits: 1240 });
    expect(applyHits(t, 100, "hfSearch", true)).toMatchObject({ status: "ok", hitsCapped: true });
    expect(applyHits(t, null, "githubTopics")).toMatchObject({ status: "ok", note: "未校验命中数" });
    const blocked = { ...t, status: "blocked" as const, note: "泛词" };
    expect(applyHits(blocked, 50, "githubTopics")).toBe(blocked);
  });
  it("排序：推荐 → 过泛 → 不可用，并截断", () => {
    const mk = (term: string, status: ClassifiedTerm["status"]): ClassifiedTerm => ({ ...c(term), status, note: "", hits: 1 });
    const r = finalizeTerms([mk("a", "blocked"), mk("b", "broad"), mk("c", "ok"), mk("d", "ok")], 3);
    expect(r.map((t) => t.term)).toEqual(["c", "d", "b"]);
  });
  it("候选上限 = 剩余名额 × 2，夹在 6–12", () => {
    expect(candidateCap("githubTopics", 0)).toBe(12);
    expect(candidateCap("githubTopics", 6)).toBe(6);
    expect(candidateCap("githubKeywords", 4)).toBe(6);
  });
});

describe("解析模型输出", () => {
  it("支持对象、数组与字符串数组，忽略坏项", () => {
    expect(parseTermOutput({ terms: [{ term: "rag", meaning: "检索增强", reason: "核心" }, { foo: 1 }, 3] })).toEqual([{ term: "rag", meaning: "检索增强", reason: "核心" }]);
    expect(parseTermOutput(["rag", "vector-database"]).map((t) => t.term)).toEqual(["rag", "vector-database"]);
    expect(parseTermOutput({ nope: true })).toEqual([]);
  });
});
