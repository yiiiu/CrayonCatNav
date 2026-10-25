import { describe, expect, it, vi } from "vitest";
import { buildUserPrompt, chat, LlmError, normalizeBaseUrl } from "./llm";

const cfg = { baseUrl: "https://llm.example.com/v1/", apiKey: "sk-secret-123456", model: "test-model" };

const okResponse = (content: string, usage = { prompt_tokens: 10, completion_tokens: 5 }) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }], usage }), { status: 200, headers: { "content-type": "application/json" } });

describe("normalizeBaseUrl", () => {
  it("去尾斜杠，误填完整路径也能用", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1/")).toBe("https://api.openai.com/v1");
    expect(normalizeBaseUrl(" https://x.com/v1/chat/completions ")).toBe("https://x.com/v1");
  });
});

describe("chat（注入 fetch，不发真实请求）", () => {
  it("按 OpenAI 兼容格式请求，开启 json_object，返回内容与用量", async () => {
    const f = vi.fn(async () => okResponse('{"ok":true}'));
    const r = await chat(cfg, [{ role: "user", content: "hi" }], { json: true, maxTokens: 50, fetchImpl: f as unknown as typeof fetch });
    expect(r).toEqual({ content: '{"ok":true}', usage: { promptTokens: 10, completionTokens: 5 } });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://llm.example.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer sk-secret-123456");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "test-model", response_format: { type: "json_object" }, max_tokens: 50 });
  });

  it("HTTP 错误透出服务端消息，但不包含密钥", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ error: { message: "Invalid API key" } }), { status: 401 }));
    const err = await chat(cfg, [], { fetchImpl: f as unknown as typeof fetch }).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.message).toContain("HTTP 401");
    expect(err.message).toContain("Invalid API key");
    expect(err.message).not.toContain("sk-secret");
  });

  it("网络错误、非 JSON、缺少内容都给出中文错误", async () => {
    const down = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(chat(cfg, [], { fetchImpl: down as unknown as typeof fetch })).rejects.toThrow(/无法连接/);
    const html = vi.fn(async () => new Response("<html>", { status: 200 }));
    await expect(chat(cfg, [], { fetchImpl: html as unknown as typeof fetch })).rejects.toThrow(/不是 JSON/);
    const empty = vi.fn(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }));
    await expect(chat(cfg, [], { fetchImpl: empty as unknown as typeof fetch })).rejects.toThrow(/没有返回内容/);
  });

  it("没有 usage 时返回 null", async () => {
    const f = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }));
    expect((await chat(cfg, [], { fetchImpl: f as unknown as typeof fetch })).usage).toBeNull();
  });
});

describe("buildUserPrompt", () => {
  it("包含来源数据、可选分类、现有标签与工具", () => {
    const p = buildUserPrompt(
      { source: "github", sourceUrl: "https://github.com/a/b", title: "b", websiteUrl: null, githubUrl: "https://github.com/a/b", description: "desc", stars: 1200, sourceUpdatedAt: new Date("2026-10-01T00:00:00Z"), hints: ["主要语言：Go"] },
      { categories: [{ slug: "mcp", name: "MCP 服务" }], tagNames: ["数据库"], tools: [{ slug: "mcp-config", name: "MCP 配置生成器", description: "生成配置" }] },
    );
    expect(p).toContain("mcp: MCP 服务");
    expect(p).toContain("数据库");
    expect(p).toContain("mcp-config: MCP 配置生成器");
    expect(p).toContain("star/点赞：1200");
    expect(p).toContain("来源更新时间：2026-10-01");
    expect(p).toContain("主要语言：Go");
  });
});
