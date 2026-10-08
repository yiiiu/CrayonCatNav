import { describe, expect, it } from "vitest";
import { deriveToolPrefill } from "./prefill";

describe("deriveToolPrefill", () => {
  it("为 MCP 服务生成合法的预填参数（带 server, cmd, args，过滤敏感字段）", () => {
    const params = deriveToolPrefill("mcp-config", {
      slug: "mcp-github",
      name: "GitHub MCP",
    });

    expect(params.get("server")).toBe("github");
    expect(params.get("cmd")).toBe("npx");
    expect(params.get("args")).toContain("@modelcontextprotocol/server-github");
    expect(params.get("client")).toBe("cursor");
    // 确保绝对无敏感字段
    expect(params.get("apiKey")).toBeNull();
    expect(params.get("env")).toBeNull();
  });

  it("为已知模型生成合法的 token-cost 预填单价参数", () => {
    const params = deriveToolPrefill("token-cost", {
      slug: "deepseek-r1",
      name: "DeepSeek R1",
    });

    expect(params.get("inPrice")).toBe("0.55");
    expect(params.get("outPrice")).toBe("2.19");
    expect(params.get("currency")).toBe("CNY");
    expect(params.get("requests")).toBeNull(); // 不在 token-cost prefillParams 白名单内
  });

  it("未知模型仅返回白名单内已有字段，不胡乱猜测", () => {
    const params = deriveToolPrefill("token-cost", {
      slug: "some-unknown-model",
      name: "未知模型",
    });

    expect(params.toString()).toBe("");
  });

  it("为 data-converter 生成默认的格式参数", () => {
    const params = deriveToolPrefill("data-converter", {
      slug: "json-yaml-resource",
      name: "资源",
    });

    expect(params.get("from")).toBe("json");
    expect(params.get("to")).toBe("yaml");
  });
});
