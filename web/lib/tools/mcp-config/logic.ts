/**
 * MCP 配置生成：纯函数，零 DOM 依赖。只支持已核实的 stdio 模式（2026-10 复核官方文档）：
 * - Cursor：.cursor/mcp.json 或 ~/.cursor/mcp.json，stdio 条目需 "type": "stdio"（cursor.com/docs/context/mcp）
 * - Claude Desktop：claude_desktop_config.json，条目为 command/args/env（modelcontextprotocol.io 本地服务器指南）
 * 不执行任何命令，不发送任何请求。
 */

export const CLIENTS = ["cursor", "claude"] as const;
export type McpClient = (typeof CLIENTS)[number];

export function isMcpClient(v: unknown): v is McpClient {
  return typeof v === "string" && (CLIENTS as readonly string[]).includes(v);
}

export type ClientInfo = {
  label: string;
  fileName: string;
  /** 经官方文档核实的配置文件位置；未列出的平台不推测 */
  locations: { label: string; path: string }[];
  note: string;
  docUrl: string;
};

export const CLIENT_INFO: Record<McpClient, ClientInfo> = {
  cursor: {
    label: "Cursor",
    fileName: "mcp.json",
    locations: [
      { label: "项目级", path: ".cursor/mcp.json" },
      { label: "全局", path: "~/.cursor/mcp.json" },
    ],
    note: "保存后在 Cursor 的 Customize 页面确认服务已启用。",
    docUrl: "https://cursor.com/docs/context/mcp",
  },
  claude: {
    label: "Claude Desktop",
    fileName: "claude_desktop_config.json",
    locations: [
      { label: "macOS", path: "~/Library/Application Support/Claude/claude_desktop_config.json" },
      { label: "Windows", path: "%APPDATA%\\Claude\\claude_desktop_config.json" },
    ],
    note: "也可在 Claude 菜单 → Settings → Developer → Edit Config 打开该文件；保存后需完全退出并重启 Claude Desktop。",
    docUrl: "https://modelcontextprotocol.io/docs/develop/connect-local-servers",
  },
};

export type EnvPair = { key: string; value: string };

export type McpInput = {
  client: McpClient;
  name: string;
  command: string;
  args: string[];
  env: EnvPair[];
};

export type McpErrors = {
  name?: string;
  command?: string;
  /** 下标 → 错误 */
  envKeys?: Record<number, string>;
};

export type McpResult =
  | { ok: true; json: string; config: unknown; warnings: string[] }
  | { ok: false; errors: McpErrors; count: number };

export const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/;
export const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function validate(input: McpInput): McpErrors {
  const errors: McpErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "服务名称为必填项";
  else if (!NAME_RE.test(name)) errors.name = "仅限字母、数字、- 和 _（最多 64 个字符）";

  const cmd = input.command.trim();
  if (!cmd) errors.command = "command 为必填项";
  else if (/[\r\n]/.test(cmd)) errors.command = "command 不能包含换行";

  const envKeys: Record<number, string> = {};
  const seen = new Set<string>();
  input.env.forEach((p, i) => {
    const k = p.key.trim();
    if (!k && !p.value) return; // 空行忽略
    if (!k) envKeys[i] = "变量名不能为空";
    else if (!ENV_KEY_RE.test(k)) envKeys[i] = "变量名仅限字母、数字、_，且不能以数字开头";
    else if (seen.has(k)) envKeys[i] = "变量名重复";
    seen.add(k);
  });
  if (Object.keys(envKeys).length) errors.envKeys = envKeys;
  return errors;
}

export function countErrors(e: McpErrors): number {
  return (e.name ? 1 : 0) + (e.command ? 1 : 0) + Object.keys(e.envKeys ?? {}).length;
}

/** 预览用的掩码：保留首尾少量字符，其余替换为 • */
export function maskValue(v: string): string {
  if (!v) return v;
  if (v.length <= 6) return "•".repeat(v.length);
  return `${v.slice(0, 3)}${"•".repeat(Math.min(12, v.length - 5))}${v.slice(-2)}`;
}

export function buildConfig(input: McpInput, opts: { mask?: boolean } = {}): McpResult {
  const errors = validate(input);
  const count = countErrors(errors);
  if (count) return { ok: false, errors, count };

  const warnings: string[] = [];
  const command = input.command.trim();
  const args = input.args.filter((a) => a.trim() !== "");
  const envPairs = input.env.filter((p) => p.key.trim());

  if (/\s/.test(command) && !/^["'].*["']$/.test(command) && !/[\\/]/.test(command)) {
    warnings.push("command 中含有空格：参数应拆到 args 中逐项填写（例如 command 填 npx，args 填 -y 与包名）。");
  }
  if (envPairs.some((p) => !p.value)) warnings.push("有环境变量的值为空，客户端启动服务时可能报错。");

  const server: Record<string, unknown> = {};
  if (input.client === "cursor") server.type = "stdio";
  server.command = command;
  if (args.length) server.args = args;
  if (envPairs.length) {
    server.env = Object.fromEntries(envPairs.map((p) => [p.key.trim(), opts.mask ? maskValue(p.value) : p.value]));
  }

  const config = { mcpServers: { [input.name.trim()]: server } };
  return { ok: true, json: JSON.stringify(config, null, 2), config, warnings };
}

/** 把一行命令（如 `npx -y @scope/pkg /path`）拆为 command + args，支持引号；供“粘贴整行命令”使用。 */
export function splitCommandLine(line: string): { command: string; args: string[] } {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  let has = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quote) {
      if (ch === quote) quote = null;
      else if (ch === "\\" && quote === '"' && (line[i + 1] === '"' || line[i + 1] === "\\")) cur += line[++i];
      else cur += ch;
    } else if (ch === '"' || ch === "'") {
      quote = ch;
      has = true;
    } else if (/\s/.test(ch)) {
      if (has || cur) out.push(cur);
      cur = "";
      has = false;
    } else {
      cur += ch;
      has = true;
    }
  }
  if (has || cur) out.push(cur);
  const [command = "", ...args] = out;
  return { command, args };
}
