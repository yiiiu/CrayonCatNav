import { describe, expect, it } from "vitest";
import { isToolSlug, pickPrefillParams, toolMetas, toolSlugs } from "./metas";

describe("工具注册表元数据", () => {
  it("slug 唯一且符合路由格式", () => {
    expect(new Set(toolSlugs).size).toBe(toolSlugs.length);
    for (const s of toolSlugs) expect(s).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
  });

  it("首版三个工具均为本地运算", () => {
    expect(toolSlugs).toEqual(["mcp-config", "data-converter", "token-cost"]);
    for (const t of toolMetas) expect(t.privacy).toBe("local");
  });

  it("isToolSlug 只认注册表内的 slug", () => {
    expect(isToolSlug("mcp-config")).toBe(true);
    expect(isToolSlug("evil")).toBe(false);
  });

  it("预填参数只保留白名单，密钥类字段被丢弃", () => {
    const qs = pickPrefillParams("mcp-config", { server: "github", cmd: "npx", env: "GITHUB_TOKEN=xxx", apiKey: "sk-1" });
    expect(qs.get("server")).toBe("github");
    expect(qs.get("cmd")).toBe("npx");
    expect(qs.has("env")).toBe(false);
    expect(qs.has("apiKey")).toBe(false);
  });
});
