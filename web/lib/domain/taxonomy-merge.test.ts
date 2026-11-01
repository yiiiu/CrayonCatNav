import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/data/taxonomy.repo", () => ({ categoryRepo: {}, tagRepo: {} }));
vi.mock("./tag-suggestion.service", () => ({ nameOwner: () => null }));

const { mergedAliases } = await import("./taxonomy.service");

describe("mergedAliases", () => {
  it("来源名称和别名并入目标别名，去重且不含目标名称", () => {
    expect(mergedAliases({ name: "AI 编程", aliases: ["AI Coding"] }, { name: "AI编程", aliases: ["ai coding", "AI 编程", "编程助手"] })).toEqual([
      "AI Coding",
      "AI编程",
      "编程助手",
    ]);
  });
});
