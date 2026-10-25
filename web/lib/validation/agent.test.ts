import { describe, expect, it } from "vitest";
import { checkCronAuth } from "@/lib/agent/cron-auth";
import { agentSettingsFromForm, agentSettingsSchema, collectLinkSchema } from "./agent";

describe("Agent 设置表单", () => {
  it("复选框与默认值", () => {
    const fd = new FormData();
    fd.set("baseUrl", "https://api.openai.com/v1");
    fd.set("model", "gpt-4o-mini");
    fd.set("srcGithub", "on");
    const v = agentSettingsSchema.parse(agentSettingsFromForm(fd));
    expect(v).toMatchObject({ maxPerRun: 8, srcGithub: true, srcMcpRegistry: false, apiKey: "", clearGithubToken: false });
  });
  it("条数上限 1–20，Base URL 需 http(s)", () => {
    expect(agentSettingsSchema.safeParse({ maxPerRun: 0 }).success).toBe(false);
    expect(agentSettingsSchema.safeParse({ maxPerRun: 21 }).success).toBe(false);
    expect(agentSettingsSchema.safeParse({ baseUrl: "ftp://x" }).success).toBe(false);
    expect(agentSettingsSchema.safeParse({ baseUrl: "http://localhost:8787/v1" }).success).toBe(true);
  });
  it("贴链接只收 http(s)", () => {
    expect(collectLinkSchema.safeParse({ url: "https://github.com/a/b" }).success).toBe(true);
    expect(collectLinkSchema.safeParse({ url: "javascript:alert(1)" }).success).toBe(false);
    expect(collectLinkSchema.safeParse({ url: "" }).success).toBe(false);
  });
});

describe("定时任务鉴权", () => {
  it("未配置 CRON_SECRET 一律拒绝", () => {
    expect(checkCronAuth("Bearer anything", undefined)).toBe("unconfigured");
    expect(checkCronAuth("Bearer ", "  ")).toBe("unconfigured");
  });
  it("只接受完全一致的 Bearer 头", () => {
    expect(checkCronAuth("Bearer s3cret", "s3cret")).toBe("ok");
    expect(checkCronAuth("Bearer wrong", "s3cret")).toBe("denied");
    expect(checkCronAuth("s3cret", "s3cret")).toBe("denied");
    expect(checkCronAuth(null, "s3cret")).toBe("denied");
  });
});
