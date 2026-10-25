import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/resource.repo", () => ({ findBySlugAny: vi.fn() }));
vi.mock("@/lib/data/agent.repo", () => ({
  reviewLookups: {
    allTags: async () => [
      { id: "t-ai", name: "AI", slug: "ai", aliases: [] },
      { id: "t-video", name: "视频剪辑", slug: "video-editing", aliases: ["视频编辑"] },
    ],
  },
}));

const { planTags } = await import("./candidate.service");

describe("planTags", () => {
  it("名称与别名命中现有标签", async () => {
    const p = await planTags([{ name: "ai" }, { name: "视频编辑" }], true);
    expect(p).toEqual({ existingIds: ["t-ai", "t-video"], newTags: [], dropped: [] });
  });
  it("带 slug 的新标签直接新建；纯英文名按规则生成 slug", async () => {
    const p = await planTags([{ name: "向量检索", slug: "vector-search" }, { name: "RAG Tools" }], true);
    expect(p.newTags).toEqual([
      { name: "向量检索", slug: "vector-search" },
      { name: "RAG Tools", slug: "rag-tools" },
    ]);
  });
  it("「AI绘画」没有 slug：上架报错，草稿丢弃", async () => {
    await expect(planTags([{ name: "AI绘画" }], true)).rejects.toThrow(/英文 slug/);
    expect((await planTags([{ name: "AI绘画" }], false)).dropped).toEqual(["AI绘画"]);
  });
  it("slug 撞上另一名称的标签：上架报错，草稿丢弃，绝不并入", async () => {
    await expect(planTags([{ name: "AI绘画", slug: "ai" }], true)).rejects.toThrow(/已被标签「AI」使用/);
    const p = await planTags([{ name: "AI绘画", slug: "ai" }], false);
    expect(p).toEqual({ existingIds: [], newTags: [], dropped: ["AI绘画"] });
  });
});
