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

describe("page_view 载荷", () => {
  it("合法：路径 + 来源主机名", () => {
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/resources/cursor", ref: "www.google.com" }).success).toBe(true);
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/" }).success).toBe(true);
  });
  it("拒绝完整来源 URL（只允许主机名）", () => {
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/", ref: "https://www.google.com/search?q=x" }).success).toBe(false);
  });
  it("拒绝后台 / 接口路径与非页面路径", () => {
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/admin/resources" }).success).toBe(false);
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/api/track" }).success).toBe(false);
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "https://evil.com/" }).success).toBe(false);
  });
  it("严格拒绝额外字段（UA、IP、query 等）", () => {
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/", ua: "x" }).success).toBe(false);
    expect(trackPayloadSchema.safeParse({ eventType: "page_view", path: "/", toolId: "mcp-config" }).success).toBe(false);
  });
  it("业务事件不能携带 path", () => {
    expect(trackPayloadSchema.safeParse({ eventType: "tool_open", toolId: "mcp-config", path: "/" }).success).toBe(false);
  });
});

