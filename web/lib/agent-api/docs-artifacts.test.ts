import { describe, expect, it } from "vitest";
import { SEARCH_LIMIT_MAX } from "./core";
import { openApiDocument } from "./openapi";
import { skillMarkdown, SKILL_NAME } from "./skill";

describe("OpenAPI 描述", () => {
  const doc = openApiDocument("https://x.dev");
  it("四个接口、服务地址正确", () => {
    expect(Object.keys(doc.paths)).toEqual(["/categories", "/tags", "/resources", "/resources/{slug}"]);
    expect(doc.servers[0].url).toBe("https://x.dev/api/agent/v1");
  });
  it("limit 上限与校验一致", () => {
    const limit = doc.paths["/resources"].get.parameters.find((p) => p.name === "limit");
    expect(limit?.schema).toMatchObject({ maximum: SEARCH_LIMIT_MAX });
  });
});

describe("SKILL.md", () => {
  const md = skillMarkdown("https://x.dev");
  it("带 name / description frontmatter，接口地址用部署域名", () => {
    expect(md.startsWith(`---\nname: ${SKILL_NAME}\ndescription: `)).toBe(true);
    expect(md).toContain("https://x.dev/api/agent/v1/categories");
  });
});
