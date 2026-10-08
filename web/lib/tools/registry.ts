import { dataConverterMeta } from "./data-converter/meta";
import { mcpConfigMeta } from "./mcp-config/meta";
import { tokenCostMeta } from "./token-cost/meta";
import type { ToolDefinition } from "./types";

/**
 * 模块化工具注册表：工具能力的唯一来源（架构 §4.5）。
 * 新增工具：lib/tools/{slug}/meta.ts → components/tool/{slug} UI → 在 metas.ts 与此处各登记一行 → 运行种子同步 Tool 表。
 */
export const toolRegistry = [
  { ...mcpConfigMeta, load: () => import("@/components/tool/McpConfigTool") },
  { ...dataConverterMeta, load: () => import("@/components/tool/DataConverterTool") },
  { ...tokenCostMeta, load: () => import("@/components/tool/TokenCostTool") },
] as const satisfies readonly ToolDefinition[];

export function getTool(slug: string): ToolDefinition | undefined {
  return toolRegistry.find((t) => t.slug === slug);
}
