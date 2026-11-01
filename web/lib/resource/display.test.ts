import { describe, expect, it } from "vitest";
import { cardTags, splitName } from "./display";

describe("splitName", () => {
  it("拆末尾全角括号说明", () => {
    expect(splitName("DeepSeek-Reasonix（面向复杂工程任务的开源编码 Agent）")).toEqual({ title: "DeepSeek-Reasonix", note: "面向复杂工程任务的开源编码 Agent" });
  });
  it("拆半角括号与破折号", () => {
    expect(splitName("rea (逆向工程命令行工具)")).toEqual({ title: "rea", note: "逆向工程命令行工具" });
    expect(splitName("Beautiful UI — AI 原生界面组件库")).toEqual({ title: "Beautiful UI", note: "AI 原生界面组件库" });
  });
  it("普通名字和连字符名字不拆", () => {
    expect(splitName("Claude Code")).toEqual({ title: "Claude Code", note: "" });
    expect(splitName("ai-website-cloner-template")).toEqual({ title: "ai-website-cloner-template", note: "" });
    expect(splitName("Qwen3 (235B)").note).toBe("");
    expect(splitName("MCP - Python SDK").note).toBe("");
  });
});

describe("cardTags", () => {
  const t = (name: string) => ({ id: name, name });
  it("去掉分类同名与写法重复的标签，最多 3 个", () => {
    const tags = [t("AI 编程"), t("AI编程"), t("Agent"), t("agent"), t("CLI"), t("开源"), t("TypeScript")];
    expect(cardTags(tags, "AI 编程").map((x) => x.name)).toEqual(["Agent", "CLI", "开源"]);
  });
  it("可调整上限", () => {
    expect(cardTags([t("a"), t("b"), t("c")], "x", 2)).toHaveLength(2);
  });
});
