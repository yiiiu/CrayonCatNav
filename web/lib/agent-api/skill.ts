/**
 * 蜡笔猫 Agent Skill（SKILL.md）内容（规格 docs/spec/Agent接入方案.md §10 第二期）。
 * 按部署域名生成，由 /skills/crayoncat/SKILL.md 路由下发；文档页展示安装命令。
 */

export const SKILL_NAME = "crayoncat";

export function skillMarkdown(origin: string): string {
  const api = `${origin}/api/agent/v1`;
  return `---
name: ${SKILL_NAME}
description: 在蜡笔猫导航（CrayonCatNav）里查找经过人工审核的 AI 资源——MCP 服务、Agent Skills、AI 编程工具、模型 API、UI 组件库、Agent 框架、本地大模型、RAG 等，并拿到官网、GitHub 和安装方式。当用户想找、比较或挑选这类工具/库/服务，或提到「蜡笔猫」时使用。Find curated AI resources (MCP servers, agent skills, UI component libraries, model APIs, agent frameworks…) on CrayonCatNav.
---

# 蜡笔猫导航（CrayonCatNav）资源查询

蜡笔猫导航收录的资源都经过人工审核。用它帮用户找到合适的工具、库或服务，再按详情里的方式接入。
挑哪一个由你自己判断：本站只提供分类、筛选和详情，不替你推荐。

## 怎么调用

- 如果已经连上名为 crayoncat 的 MCP 服务，直接用它的工具：\`list_categories\`、\`list_tags\`、\`search_resources\`、\`get_resource\`。
- 否则用 HTTP API（只读 GET，返回 JSON，无需 API Key）：\`${api}\`

## 工作流程

1. **看分类**：\`curl -s ${api}/categories\`
   返回 \`categories[]\`：\`slug\`、\`name\`、\`count\`。根据需求选一个分类，例如组件库选 \`ui-components\`。
2. **筛选**：\`curl -s "${api}/resources?category=ui-components&q=React%20无样式&limit=10"\`
   - \`q\`：关键词或一句需求描述，中英文均可（URL 编码）
   - \`category\`：分类 slug
   - \`tag\`：标签 slug，可重复传多个（需同时具备）；先 \`curl -s "${api}/tags?category=<slug>"\` 查看可用标签
   - \`pricing\`：\`free\` / \`freemium\` / \`paid\`
   - \`limit\`：1–20，默认 10；\`nextCursor\` 不为 null 时用 \`cursor=<nextCursor>\` 翻页
   结果为空时：去掉 \`q\` 只按分类看，或换更短的关键词。
3. **看详情**：\`curl -s ${api}/resources/<slug>\`
   重点字段：\`summary\`、\`highlights\`、\`useCases\`、\`platforms\`、\`pricing\` / \`pricingNote\`、\`websiteUrl\`、\`githubUrl\`、\`quickstart\`（安装命令或配置片段，可能为 null）、\`siteTools\`（本站已预填的配套工具，如 MCP 配置生成器）。
4. **选择并接入**：对比 2–3 个候选，结合用户的技术栈和约束挑一个，说明理由。
   有 \`quickstart\` 时按它安装；没有时到 \`websiteUrl\` / \`githubUrl\` 查官方文档，不要编造安装命令。

## 注意

- 每个 IP 每分钟 60 次、每天 2000 次；收到 429 时按 \`Retry-After\` 秒数等待后重试，不要连续重试。
- 只返回已发布资源；404 表示 slug 不存在，用搜索重新查找。
- 给用户回复时附上资源的站内链接 \`url\`，方便他查看。
`;
}
