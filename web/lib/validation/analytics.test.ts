import { describe, expect, it } from "vitest";
import { trackPayloadSchema } from "./analytics";

describe("trackPayloadSchema", () => {
  it("通过合法的白名单埋点事件", () => {
    const valid = trackPayloadSchema.safeParse({
      eventType: "tool_open",
      toolId: "mcp-config",
    });
    expect(valid.success).toBe(true);
  });

  it("通过资源到工具点击事件", () => {
    const valid = trackPayloadSchema.safeParse({
      eventType: "resource_to_tool_click",
      toolId: "mcp-config",
      resourceId: "mcp-github",
    });
    expect(valid.success).toBe(true);
  });

  it("拒绝未注册的非法 toolId", () => {
    const invalid = trackPayloadSchema.safeParse({
      eventType: "tool_open",
      toolId: "malicious-unknown-tool",
    });
    expect(invalid.success).toBe(false);
  });

  it("严格拒绝携带未预期字段（如 input, apiKey, secret）", () => {
    const dangerous = trackPayloadSchema.safeParse({
      eventType: "tool_execute",
      toolId: "mcp-config",
      apiKey: "sk-12345678",
      userInput: "rm -rf /",
    });
    expect(dangerous.success).toBe(false);
  });

  it("拒绝非白名单事件名称", () => {
    const invalid = trackPayloadSchema.safeParse({
      eventType: "custom_unauthorized_event",
    });
    expect(invalid.success).toBe(false);
  });
});
