import { describe, expect, it } from "vitest";
import { buildConfig, maskValue, splitCommandLine, type McpInput } from "./logic";

const base: McpInput = { client: "cursor", name: "filesystem", command: "npx", args: [], env: [] };

function ok(r: ReturnType<typeof buildConfig>) {
  if (!r.ok) throw new Error(`期望成功：${JSON.stringify(r.errors)}`);
  return r;
}

describe("MCP 配置生成", () => {
  it("无参数命令：Cursor 带 type=stdio，省略空 args/env", () => {
    const r = ok(buildConfig(base));
    expect(JSON.parse(r.json)).toEqual({ mcpServers: { filesystem: { type: "stdio", command: "npx" } } });
  });

  it("带 args：空白参数被忽略，顺序保持", () => {
    const r = ok(buildConfig({ ...base, args: ["-y", "", "@modelcontextprotocol/server-filesystem", "/Users/me"] }));
    expect(JSON.parse(r.json).mcpServers.filesystem.args).toEqual(["-y", "@modelcontextprotocol/server-filesystem", "/Users/me"]);
  });

  it("切换到 Claude Desktop：结构为 command/args/env，无 type", () => {
    const r = ok(buildConfig({ ...base, client: "claude", name: "github", args: ["-y", "@modelcontextprotocol/server-github"], env: [{ key: "GITHUB_PERSONAL_ACCESS_TOKEN", value: "ghp_abc123456" }] }));
    const srv = JSON.parse(r.json).mcpServers.github;
    expect(srv.type).toBeUndefined();
    expect(srv.env).toEqual({ GITHUB_PERSONAL_ACCESS_TOKEN: "ghp_abc123456" });
  });

  it("带 env：预览可掩码，复制版本保留原值", () => {
    const input = { ...base, env: [{ key: "API_KEY", value: "sk-1234567890" }] };
    expect(JSON.parse(ok(buildConfig(input, { mask: true })).json).mcpServers.filesystem.env.API_KEY).not.toContain("4567");
    expect(JSON.parse(ok(buildConfig(input)).json).mcpServers.filesystem.env.API_KEY).toBe("sk-1234567890");
  });

  it("空命令与非法名称：返回字段级错误与计数", () => {
    const r = buildConfig({ ...base, name: "my server", command: "  " });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.count).toBe(2);
    expect(r.errors.name).toBeTruthy();
    expect(r.errors.command).toBe("command 为必填项");
  });

  it("env 变量名非法/重复被拒绝，空行忽略", () => {
    const r = buildConfig({ ...base, env: [{ key: "1BAD", value: "x" }, { key: "", value: "" }, { key: "A", value: "1" }, { key: "A", value: "2" }] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(Object.keys(r.errors.envKeys ?? {})).toEqual(["0", "3"]);
  });

  it("含引号/反斜杠的参数被正确转义，结果可解析", () => {
    const args = ['C:\\Users\\me\\Projects', 'say "hi"', "it's"];
    const r = ok(buildConfig({ ...base, client: "claude", args }));
    expect(JSON.parse(r.json).mcpServers.filesystem.args).toEqual(args);
  });

  it("command 含空格时给出拆分提示", () => {
    const r = ok(buildConfig({ ...base, command: "npx -y foo" }));
    expect(r.warnings.length).toBe(1);
  });

  it("splitCommandLine 支持引号", () => {
    expect(splitCommandLine('npx -y @scope/pkg "/Users/me/My Docs" \'a b\' ""')).toEqual({
      command: "npx",
      args: ["-y", "@scope/pkg", "/Users/me/My Docs", "a b", ""],
    });
  });

  it("maskValue 不泄露中间内容", () => {
    expect(maskValue("abc")).toBe("•••");
    expect(maskValue("ghp_secretvalue99")).toMatch(/^ghp•+99$/);
  });
});
