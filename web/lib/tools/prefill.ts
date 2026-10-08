import { pickPrefillParams, type ToolSlug } from "./metas";

export type PrefillSourceResource = {
  slug: string;
  name: string;
  summary?: string;
  categorySlug?: string;
};

/** 已知常用 MCP 服务的默认命令与参数映射（官方包为主） */
const KNOWN_MCP_SERVERS: Record<string, { cmd: string; args: string }> = {
  filesystem: { cmd: "npx", args: "-y @modelcontextprotocol/server-filesystem /path/to/dir" },
  github: { cmd: "npx", args: "-y @modelcontextprotocol/server-github" },
  postgres: { cmd: "npx", args: "-y @modelcontextprotocol/server-postgres postgresql://localhost/mydb" },
  "brave-search": { cmd: "npx", args: "-y @modelcontextprotocol/server-brave-search" },
  fetch: { cmd: "npx", args: "-y @modelcontextprotocol/server-fetch" },
  memory: { cmd: "npx", args: "-y @modelcontextprotocol/server-memory" },
  puppeteer: { cmd: "npx", args: "-y @modelcontextprotocol/server-puppeteer" },
};

/** 已知主流模型的参考单价（单位：每百万 Token，仅作预填参考） */
const KNOWN_MODEL_PRICES: Record<string, { inPrice: string; outPrice: string; currency: string }> = {
  "claude-3-5-sonnet": { inPrice: "3", outPrice: "15", currency: "USD" },
  "gpt-4o": { inPrice: "2.5", outPrice: "10", currency: "USD" },
  "deepseek-r1": { inPrice: "0.55", outPrice: "2.19", currency: "CNY" },
  "gemini-1-5-pro": { inPrice: "1.25", outPrice: "5", currency: "USD" },
};

/**
 * 根据资源信息推导针对特定工具的非敏感预填参数，并严格经过白名单过滤。
 * 严禁携带任何 API Key、密码或用户未公开敏感参数。
 */
export function deriveToolPrefill(toolSlug: ToolSlug, resource: PrefillSourceResource): URLSearchParams {
  const rawParams: Record<string, string> = {};

  if (toolSlug === "mcp-config") {
    const serverKey = resource.slug.replace(/^mcp-/, "").toLowerCase();
    rawParams.client = "cursor";
    rawParams.server = serverKey;

    const known = KNOWN_MCP_SERVERS[serverKey];
    if (known) {
      rawParams.cmd = known.cmd;
      rawParams.args = known.args;
    } else {
      rawParams.cmd = "npx";
      rawParams.args = `-y @modelcontextprotocol/server-${serverKey}`;
    }
  } else if (toolSlug === "token-cost") {
    const price = KNOWN_MODEL_PRICES[resource.slug];
    if (price) {
      rawParams.inPrice = price.inPrice;
      rawParams.outPrice = price.outPrice;
      rawParams.currency = price.currency;
    }
  } else if (toolSlug === "data-converter") {
    rawParams.from = "json";
    rawParams.to = "yaml";
  }

  return pickPrefillParams(toolSlug, rawParams);
}
