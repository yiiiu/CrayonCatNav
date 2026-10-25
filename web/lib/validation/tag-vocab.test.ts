import { describe, expect, it } from "vitest";
import { buildVocab, cleanTagOutput, formatTagInput, parseTagEntry, parseTagInput, resolveTag } from "./tag-vocab";

const vocab = buildVocab(
  [
    { name: "AI", slug: "ai" },
    { name: "视频剪辑", slug: "video-editing", aliases: ["视频编辑", "Video Edit"] },
    { name: "开源", slug: "open-source" },
  ],
  [
    { name: "营销号", slug: "marketing", status: "ignored" },
    { name: "向量检索", slug: "vector-search", status: "open" },
  ],
);

describe("resolveTag", () => {
  it("名称与别名都映射到规范名称，忽略大小写", () => {
    expect(resolveTag("ai", vocab)).toBe("AI");
    expect(resolveTag("视频编辑", vocab)).toBe("视频剪辑");
    expect(resolveTag("video edit", vocab)).toBe("视频剪辑");
    expect(resolveTag("没见过", vocab)).toBeNull();
  });
});

describe("cleanTagOutput", () => {
  it("tags 只留现有标签，最多 6 个并去重", () => {
    const r = cleanTagOutput(["AI", "#ai", "视频编辑", "Postgres", "  "], [], vocab);
    expect(r.tags).toEqual(["AI", "视频剪辑"]);
  });
  it("「AI绘画」slug 撞上现有的 ai 时丢弃，不并入 AI", () => {
    const r = cleanTagOutput([], [{ name: "AI绘画", slug: "ai" }], vocab);
    expect(r).toEqual({ tags: [], suggestedTags: [] });
  });
  it("已忽略的词（按名称或 slug）丢弃；非法 slug 丢弃；最多 2 个", () => {
    const r = cleanTagOutput(
      [],
      [
        { name: "营销号", slug: "ads" },
        { name: "广告", slug: "marketing" },
        { name: "坏的", slug: "坏" },
        { name: "向量检索", slug: "vector-search" },
        { name: "AI绘画", slug: "ai-painting" },
        { name: "第三个", slug: "third" },
      ],
      vocab,
    );
    expect(r.suggestedTags).toEqual([
      { name: "向量检索", slug: "vector-search" },
      { name: "AI绘画", slug: "ai-painting" },
    ]);
  });
  it("建议词命中别名时并入 tags", () => {
    expect(cleanTagOutput([], [{ name: "视频编辑", slug: "video-edit" }], vocab).tags).toEqual(["视频剪辑"]);
  });
});

describe("审核输入", () => {
  it("解析「名字」与「名字:slug」", () => {
    expect(parseTagEntry("数据库")).toEqual({ name: "数据库" });
    expect(parseTagEntry("视频剪辑 : Video-Editing")).toEqual({ name: "视频剪辑", slug: "video-editing" });
    expect(parseTagEntry("  ")).toBeNull();
  });
  it("去重并保留顺序", () => {
    expect(parseTagInput("A，a, B:b")).toEqual([{ name: "A" }, { name: "B", slug: "b" }]);
  });
  it("默认值：现有标签写名字，建议词写成「名字:slug」", () => {
    expect(formatTagInput(["AI"], [{ name: "向量检索", slug: "vector-search" }])).toBe("AI，向量检索:vector-search");
  });
});
