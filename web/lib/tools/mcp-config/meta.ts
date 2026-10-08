import type { ToolMeta } from "../types";

export const mcpConfigMeta = {
  slug: "mcp-config",
  name: "MCP 配置生成器",
  description: "为 Cursor、Claude Desktop 生成 MCP 服务配置 JSON，密钥只在本地处理。",
  category: "ai-config",
  icon: "plug",
  privacy: "local",
  defaultStatus: "enabled",
  sortOrder: 10,
  prefillParams: ["client", "server", "cmd", "args"],
} as const satisfies ToolMeta;
