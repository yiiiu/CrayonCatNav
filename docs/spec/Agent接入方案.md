# 蜡笔猫 Agent 接入方案

> 状态：第一期已在分支 `agent-access` 实现（2026-11-01），待预览验收。
> 目标：让外部 Agent（Claude Code、Cursor、Codex 等）通过 MCP / Skill / CLI / HTTP API 直接查询本站已收录资源，自己按分类筛选、挑出最合适的资源并使用。

## 1. 原则

- **只读**：只返回 `published` 资源、分类和标签，不碰后台，不写任何数据。
- **不花模型钱**：挑哪个资源由调用方 Agent 自己的模型判断。本站只提供分类、筛选和详情，**不暴露 AI 推荐接口**，避免被当成免费模型代理，也不占推荐预算。
- **匿名 + 限流**：第一期不需要 API Key，按 IP 限流（复用数据库限流 `lib/security/rate-limit`）。API Key 列为待定事项（§9）。
- **隐私一致**：只记调用次数、工具名、客户端名，不记查询原文。
- **一个核心，多层薄壳**：HTTP API、MCP、Skill、CLI 都调用同一个核心服务，行为一致。

## 2. 典型流程

Agent 收到任务「在蜡笔猫找一个可用的 UI 组件库」：

1. `list_categories` → 看到 `ui-components`（UI 组件库，N 个）
2. `search_resources({ category: "ui-components", query: "React 无样式 可访问性", pricing: "free" })` → 拿到精简候选
3. `get_resource({ slug })` → 拿到详情、链接、接入方式 → 安装使用

## 3. 核心服务

`lib/domain/agent-api.service.ts`（server-only），复用 `resource.repo`、`lib/recommend/prefilter` 的打分和标签别名。

| 方法 | 入参 | 返回 |
| --- | --- | --- |
| `listCategories()` | — | `{ slug, name, count }[]`，只算已发布、只列有资源的分类 |
| `listTags(category?)` | 分类 slug | `{ slug, name, count }[]`，按数量降序，最多 50 |
| `searchResources(input)` | `query?`（≤100 字）、`category?`、`tags?`（≤5）、`pricing?`（free / freemium / paid）、`limit`（1–20，默认 10）、`cursor?` | `{ items, nextCursor, total }` |
| `getResource(slug)` | slug | 详情；不存在或未发布返回 not_found |

- 列表项字段尽量精简，省 Agent 上下文：`slug, name, summary, category, tags(≤5), pricing, websiteUrl, githubUrl, url`（站内详情页）。
- 详情额外返回：`description`（截断 2000 字）、全部标签、`highlights / useCases / platforms / pricingNote / quickstart`（来自 details JSON）、`siteTools`（站内配套工具，已预填）。
- 有 `query` 时按粗筛分数排序；没有时按精选顺序 → 最近更新。
- 输入用 zod 校验（`lib/validation/agent-api.ts`），非法参数返回清楚的错误说明，方便 Agent 自己改参数重试。
- 目录一次取全量已发布资源（`listAgentCatalog`，cache tag `resources`），筛选、打分、分页在内存里做（`lib/agent-api/core.ts`，纯函数有单测）；cursor 为偏移量。

## 4. HTTP API

前缀 `/api/agent/v1`，只有 GET，JSON，开放 CORS（`*`，无 cookie）。

- `GET /categories`
- `GET /tags?category=`
- `GET /resources?q=&category=&tag=&tag=&pricing=&limit=&cursor=`
- `GET /resources/{slug}`

统一错误格式：`{ ok: false, code, message }`，code 为 `invalid_input` / `not_found` / `rate_limited` / `error`。限流返回 429 + `Retry-After`。

配套：
- 第二期：`GET /api/agent/v1/openapi.json`（OpenAPI 3.1）、`/llms.txt`

## 5. MCP 服务

- 路由 `/api/mcp`，Streamable HTTP、**无状态**（适合 Vercel 无服务器，不需要 Redis 存会话）。
- 依赖：`mcp-handler` 2.3.0 + `@modelcontextprotocol/server` 2.x（同时支持 2026-07-28 规范与 2025 版 Streamable HTTP 无状态回退，不需要 Redis）。限流在路由外层按 HTTP 请求计。
- 工具（名称英文，描述中英双语，标注 `readOnlyHint: true`）：
  - `list_categories`
  - `list_tags(category?)`
  - `search_resources(query?, category?, tags?, pricing?, limit?, cursor?)`
  - `get_resource(slug)`
- 工具返回：`structuredContent`（JSON）+ 一段简短文本摘要。
- 服务端 `instructions` 写明推荐调用顺序。
- `maxDuration` 15 秒。

## 6. 接入方式（setup）

让 Agent 拿到资源后能直接用，是和普通导航站拉开差距的地方：

- `quickstart`：资源 details 里的快速上手（安装命令 / 配置片段），没有就是 null，不编造；覆盖率由采集补全 Agent 后续提高（第二期）。
- `siteTools`：资源关联的站内工具链接，已按资源预填（如 MCP 配置生成器）。

## 7. 文档中心 `/docs`

用户要求的文档入口，第一期和 MCP 一起上线：

- 入口：顶部导航「Agent 接入」+ 页脚「接入文档」。已上线页面进 sitemap，预告页不进。
- 结构（左侧目录，右侧内容）：
  1. 概览：能做什么、限流说明、隐私说明
  2. MCP 接入：服务地址；Claude Code、Cursor、Codex、VS Code 各自的配置（分标签页，一键复制）；验证方法
  3. Skill 接入：下载 / 安装 Skill 包，放到对应目录
  4. CLI 接入：`npx` 用法和命令说明
  5. HTTP API 参考：每个接口的参数、示例请求和响应、错误码
- 还没上线的部分标「即将推出」。
- 代码块统一带复制按钮；风格沿用站内蜡笔风组件。
- SEO：每篇单独页面，进 sitemap。

## 8. 限流与统计

新增桶（数值可在实现时微调）：

| 桶 | 主体 | 限制 |
| --- | --- | --- |
| `agent_ip_min` | IP | 60 次 / 分钟 |
| `agent_ip_day` | IP | 2000 次 / 天 |
| `agent_global_day` | 全站 | 50000 次 / 天 |

统计：表 `AgentApiDaily`（北京时间自然日 × 通道 http/mcp × 工具名）累加，后台「数据总览」显示近 30 天。客户端名在无状态模式下拿不到，暂不统计。不记查询原文和参数。

## 9. 待定（TODO）

- **API Key**：是否需要、谁来发放（后台生成 + 申请表 / 访客自助）。设计备忘：`ccn_` 前缀，只存 SHA-256 哈希，生成时只显示一次，可吊销，记最后使用时间，按 Key 单独限流；HTTP/MCP 用 `Authorization: Bearer`，CLI 读环境变量 `CRAYONCAT_API_KEY`。上线 Key 前匿名调用保持可用。
- 是否开放 AI 推荐工具（目前不开放）。

## 10. 分期

1. 核心服务 + HTTP API + MCP + `/docs`（MCP、HTTP API 两篇写全）+ 限流统计
2. Skill 包 + `/llms.txt` + OpenAPI；补「接入方式」数据
3. CLI 发 npm（`crayoncat search / show / categories`）

### 进度（2026-11-01）

- 第一期：已推送 agent-access（6af0a9a），Vercel 预览通过。
- 第二期（不含「补接入方式数据」）：`lib/agent-api/skill.ts` → `/skills/crayoncat/SKILL.md`（按部署域名生成；安装路径 Claude Code `~/.claude/skills`、Codex `~/.agents/skills`、Cursor `~/.cursor/skills`、VS Code `~/.copilot/skills`）；`lib/agent-api/openapi.ts` → `/api/agent/v1/openapi.json`（手写，改参数时同步，单测校验 limit 上限）；`/llms.txt`（分类表按收录数动态生成）；`/docs/skill` 上线。
- 第三期：仓库根 `cli/`（npm 包名 `crayoncat`，零依赖、Node 20+，`node --test`），命令 categories / tags / search / show，`--json`、`--base` / `CRAYONCAT_BASE_URL`；退出码 0/1/2/4。npm 尚未发布，`/docs/cli` 保持「即将推出」。
- 补「接入方式」（quickstart）数据：待做，走采集补全或后台编辑。

## 11. 验收

- 用 MCP Inspector 和 Claude Code 实际连上，跑通「找 UI 组件库」等 5 个任务
- 未发布资源查不到；非法参数有清楚提示；限流 429 正常
- typecheck / lint / test / build 通过，Vercel 预览验收后再合 main
