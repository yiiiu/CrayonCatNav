import { describe, expect, it } from "vitest";
import { resourceInputSchema } from "./resource";

const base = {
  slug: "github-mcp-server",
  name: "GitHub MCP Server",
  summary: "官方 MCP 服务器",
  categoryId: "c1",
  websiteUrl: "",
  githubUrl: "",
  iconUrl: "",
  tagIds: [] as string[],
  toolIds: [] as string[],
};

describe("resourceInputSchema", () => {
  it("草稿允许缺链接和标签", () => {
    expect(resourceInputSchema.safeParse({ ...base, status: "draft" }).success).toBe(true);
  });

  it("发布必须有链接和标签", () => {
    const r = resourceInputSchema.safeParse({ ...base, status: "published" });
    expect(r.success).toBe(false);
    const paths = r.error!.issues.map((i) => i.path.join("."));
    expect(paths).toContain("websiteUrl");
    expect(paths).toContain("tagIds");
  });

  it("发布：GitHub 链接 + 标签即可", () => {
    const r = resourceInputSchema.safeParse({ ...base, status: "published", githubUrl: "https://github.com/github/github-mcp-server", tagIds: ["t1"] });
    expect(r.success).toBe(true);
  });

  it("拒绝 http 与非仓库 GitHub 链接", () => {
    expect(resourceInputSchema.safeParse({ ...base, websiteUrl: "http://x.com" }).success).toBe(false);
    expect(resourceInputSchema.safeParse({ ...base, githubUrl: "https://github.com/github" }).success).toBe(false);
  });

  it("空字符串链接转为 undefined", () => {
    const r = resourceInputSchema.parse({ ...base });
    expect(r.websiteUrl).toBeUndefined();
    expect(r.status).toBe("draft");
  });
});
