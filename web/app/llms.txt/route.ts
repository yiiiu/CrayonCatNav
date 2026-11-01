import { SKILL_NAME } from "@/lib/agent-api/skill";
import { listCategoriesWithCounts } from "@/lib/data/taxonomy.repo";
import { siteConfig } from "@/lib/site";

/** GET /llms.txt：给 LLM / Agent 读的站点说明（llmstxt.org 格式）。 */
export async function GET() {
  const o = siteConfig.url.replace(/\/$/, "");
  const cats = (await listCategoriesWithCounts()).filter((c) => c._count.resources > 0);
  const body = `# ${siteConfig.name}（CrayonCatNav）

> ${siteConfig.description} 收录的资源都经过人工审核。Agent 可以通过 MCP 或 HTTP API 只读查询，无需 API Key。

## 接入方式

- [MCP 服务](${o}/docs/mcp): Streamable HTTP，地址 ${o}/api/mcp，工具 list_categories / list_tags / search_resources / get_resource
- [HTTP API](${o}/docs/api): ${o}/api/agent/v1，OpenAPI 描述 ${o}/api/agent/v1/openapi.json
- [Agent Skill](${o}/docs/skill): ${o}/skills/${SKILL_NAME}/SKILL.md
- [CLI](${o}/docs/cli): npx crayoncat

## 分类

${cats.map((c) => `- [${c.name}](${o}/resources?cat=${c.slug}): slug \`${c.slug}\`，${c._count.resources} 个资源`).join("\n")}

## 其他

- [全部资源](${o}/resources)
- [在线工具箱](${o}/tools): MCP 配置生成、JSON/YAML/TOML 转换、Token 成本估算
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
