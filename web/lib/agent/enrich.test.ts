import { describe, expect, it } from "vitest";
import { emptyDetails } from "@/lib/validation/resource-details";
import { buildEnrichPrompt, ENRICH_SYSTEM_PROMPT, htmlToText, mergeDetails, readmeUrls } from "./enrich";

describe("htmlToText", () => {
  it("取标题与描述，去掉脚本样式和标签", () => {
    const html = `<html><head><title>Foo &amp; Bar</title><meta name="description" content="AI 写作助手"><style>.a{}</style></head>
      <body><script>var x=1</script><h1>快速写作</h1><p>支持&nbsp;多语言</p><!-- hidden --></body></html>`;
    const t = htmlToText(html);
    expect(t).toContain("标题：Foo & Bar");
    expect(t).toContain("描述：AI 写作助手");
    expect(t).toContain("快速写作");
    expect(t).toContain("支持 多语言");
    expect(t).not.toMatch(/var x|\.a\{|hidden/);
  });
  it("按上限截断", () => {
    expect(htmlToText(`<p>${"字".repeat(100)}</p>`, 20)).toHaveLength(20);
  });
});

describe("mergeDetails", () => {
  it("只填空字段，不覆盖已有内容", () => {
    const cur = { ...emptyDetails(), highlights: ["人工写的"] };
    const gen = { ...emptyDetails(), highlights: ["AI"], useCases: ["开发者"], platforms: ["cli" as const] };
    const r = mergeDetails(cur, gen, null, "https://a.com/og.png");
    expect(r.details.highlights).toEqual(["人工写的"]);
    expect(r.details.useCases).toEqual(["开发者"]);
    expect(r.filled).toEqual(["useCases", "platforms", "previewImageUrl"]);
  });
  it("已有预览图不替换；生成为空不算填入", () => {
    const r = mergeDetails(emptyDetails(), emptyDetails(), "https://x/1.png", "https://x/2.png");
    expect(r.previewImageUrl).toBe("https://x/1.png");
    expect(r.filled).toEqual([]);
  });
});

describe("prompt", () => {
  it("缺资料时明确标注，系统提示禁止编造", () => {
    const p = buildEnrichPrompt({ name: "X", summary: "s", description: "", websiteUrl: null, githubUrl: null }, { site: null, readme: null });
    expect(p).toContain("（未能获取）");
    expect(ENRICH_SYSTEM_PROMPT).toContain("不编造");
  });
});

describe("readmeUrls", () => {
  it("生成 raw README 地址", () => {
    expect(readmeUrls("https://github.com/a/b.git")[0]).toBe("https://raw.githubusercontent.com/a/b/HEAD/README.md");
    expect(readmeUrls("https://example.com")).toEqual([]);
  });
});
