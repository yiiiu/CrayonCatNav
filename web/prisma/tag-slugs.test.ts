import { describe, expect, it } from "vitest";
import { slugSchema } from "../lib/validation/common";
import { TAG_SLUGS, tagSlugFor } from "./tag-slugs";

describe("tagSlugFor", () => {
  it("中文标签走映射表", () => {
    expect(tagSlugFor("GUI操作")).toBe("gui-automation");
    expect(tagSlugFor("Web界面")).toBe("web-ui");
  });
  it("英文标签按规则转换", () => {
    expect(tagSlugFor("LangChain")).toBe("langchain");
    expect(tagSlugFor("Claude Code")).toBe("claude-code");
  });
  it("未收录的中文标签直接报错，不生成编码 slug", () => {
    expect(() => tagSlugFor("未知标签")).toThrow(/tag-slugs/);
  });
  it("中英混合且未收录时报错，不再退化成英文部分", () => {
    expect(() => tagSlugFor("AI绘画")).toThrow(/英文 slug/);
    expect(() => tagSlugFor("GPT 插件")).toThrow();
  });
  it("映射表里的 slug 全部合法且互不重复", () => {
    const values = Object.values(TAG_SLUGS);
    for (const v of values) expect(slugSchema.safeParse(v).success).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});

describe("种子里的全部标签", () => {
  it("都能得到合法且不冲突的 slug", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(new URL("./seed.ts", import.meta.url), "utf8");
    const names = [
      ...new Set(
        [...src.matchAll(/tags:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1])),
      ),
    ];
    expect(names.length).toBeGreaterThan(0);
    const slugs = names.map(tagSlugFor);
    for (const s of slugs) expect(slugSchema.safeParse(s).success).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
