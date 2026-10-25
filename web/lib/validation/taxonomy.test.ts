import { describe, expect, it } from "vitest";
import { tagFormSchema } from "./taxonomy";

describe("tagFormSchema", () => {
  it("别名按逗号、顿号、换行拆分，忽略大小写去重", () => {
    const r = tagFormSchema.parse({ name: "视频剪辑", slug: "video-editing", aliases: "视频编辑，Video Edit、video edit\n剪辑" });
    expect(r.aliases).toEqual(["视频编辑", "Video Edit", "剪辑"]);
  });
  it("别名可以为空；单个超过 20 字报错", () => {
    expect(tagFormSchema.parse({ name: "AI", slug: "ai" }).aliases).toEqual([]);
    expect(tagFormSchema.safeParse({ name: "AI", slug: "ai", aliases: "长".repeat(21) }).success).toBe(false);
  });
});
