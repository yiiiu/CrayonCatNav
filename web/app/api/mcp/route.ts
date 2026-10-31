import { createMcpHandler } from "mcp-handler";
import { NextResponse } from "next/server";
import { z } from "zod";
import { resourceInput, searchInput, tagsInput } from "@/lib/agent-api/core";
import { clientIp } from "@/lib/analytics/visitor";
import {
  getResource,
  guard,
  listCategories,
  listTags,
  searchResources,
  track,
  type AgentResult,
  type AgentTool,
} from "@/lib/domain/agent-api.service";
import { UNKNOWN_IP } from "@/lib/security/rate-limit";

/**
 * 蜡笔猫 MCP 服务（规格 docs/spec/Agent接入方案.md §5）：Streamable HTTP、无状态，只读。
 * 工具与 HTTP API 一一对应，都走 lib/domain/agent-api.service。
 */
export const maxDuration = 15;

const INSTRUCTIONS = `蜡笔猫导航（CrayonCatNav）收录了经过人工审核的 AI 资源：MCP 服务、Agent Skills、AI 编程工具、模型/API、UI 组件库、Agent 框架等。
推荐用法：先 list_categories 看有哪些分类 → 用 search_resources 按分类/关键词/标签/价格筛选 → 对候选调用 get_resource 查看详情与快速上手，再决定使用哪一个。
CrayonCatNav is a curated directory of AI resources. Typical flow: list_categories → search_resources → get_resource.`;

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const;

/** 核心服务结果 → MCP 工具结果：成功时 structuredContent + JSON 文本；失败时 isError + 原因。 */
async function call<T extends object>(tool: AgentTool, run: () => Promise<AgentResult<T>>) {
  const r = await run();
  track("mcp", tool);
  if (!r.ok) return { isError: true, content: [{ type: "text" as const, text: `${r.code}: ${r.message}` }] };
  return { structuredContent: r.data as Record<string, unknown>, content: [{ type: "text" as const, text: JSON.stringify(r.data) }] };
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_categories",
      {
        title: "列出分类 / List categories",
        description: "列出蜡笔猫导航的资源分类（slug、名称、已收录数量）。先用它确定要在哪个分类里找。\nList resource categories with slug, name and count.",
        inputSchema: z.object({}),
        annotations: READ_ONLY,
      },
      () => call("list_categories", () => listCategories()),
    );
    server.registerTool(
      "list_tags",
      {
        title: "列出标签 / List tags",
        description: "列出常用标签（可限定分类），按使用量排序，最多 50 个。用返回的 slug 作为 search_resources 的 tags 筛选。\nList popular tags, optionally within a category.",
        inputSchema: tagsInput,
        annotations: READ_ONLY,
      },
      (args) => call("list_tags", () => listTags(args)),
    );
    server.registerTool(
      "search_resources",
      {
        title: "搜索资源 / Search resources",
        description:
          "按关键词、分类、标签、价格筛选已收录资源，返回精简列表（slug、名称、简介、标签、价格、链接）。有 nextCursor 时可翻页。\nSearch curated resources by query, category, tags and pricing. Use get_resource for details.",
        inputSchema: searchInput,
        annotations: READ_ONLY,
      },
      (args) => call("search_resources", () => searchResources(args)),
    );
    server.registerTool(
      "get_resource",
      {
        title: "资源详情 / Get resource",
        description:
          "获取单个资源详情：介绍、核心功能、适用场景、支持平台、价格说明、快速上手（安装命令或配置片段，没有则为 null），以及站内配套工具链接（如已预填的 MCP 配置生成器）。\nGet full details for one resource, including quickstart and setup helpers.",
        inputSchema: resourceInput,
        annotations: READ_ONLY,
      },
      (args) => call("get_resource", () => getResource(args)),
    );
  },
  { serverInfo: { name: "crayoncat-nav", version: "1.0.0" }, instructions: INSTRUCTIONS },
);

async function limited(req: Request): Promise<Response> {
  const limit = await guard(clientIp(req.headers) || UNKNOWN_IP);
  if (!limit.ok)
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32000, message: `请求太频繁，请 ${limit.retryAfterSec} 秒后再试 / Rate limited` } },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSec) } },
    );
  return handler(req);
}

export { limited as GET, limited as POST, limited as DELETE };
