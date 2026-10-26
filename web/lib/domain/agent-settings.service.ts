import "server-only";
import { collectScheduleLabel, nextCollectRun } from "@/lib/agent/cron-schedule";
import { decryptSecret, encryptSecret, keySource, last4 } from "@/lib/agent/crypto";
import { chat, LlmError, type ChatConfig } from "@/lib/agent/llm";
import * as repo from "@/lib/data/agent.repo";
import { agentSettingsSchema } from "@/lib/validation/agent";
import { DomainError } from "./result";

/** 页面展示用：不含任何明文或密文，只有末四位与可用状态。 */
export async function getSettingsView() {
  const s = await repo.getSetting();
  const unreadable = (enc: string | null) => !!enc && decryptSecret(enc) === null;
  return {
    baseUrl: s.baseUrl,
    model: s.model,
    maxPerRun: s.maxPerRun,
    srcMcpRegistry: s.srcMcpRegistry,
    srcGithub: s.srcGithub,
    srcAwesome: s.srcAwesome,
    srcHuggingface: s.srcHuggingface,
    srcProductHunt: s.srcProductHunt,
    cron: {
      enabled: s.cronEnabled,
      /** 没配 CRON_SECRET 时接口直接拒绝，开关打开也不会跑 */
      secretConfigured: !!process.env.CRON_SECRET,
      schedule: collectScheduleLabel(),
      nextRunAt: nextCollectRun().toISOString(),
    },
    apiKeyLast4: s.apiKeyEnc ? s.apiKeyLast4 : null,
    githubTokenLast4: s.githubTokenEnc ? s.githubTokenLast4 : null,
    phTokenLast4: s.phTokenEnc ? s.phTokenLast4 : null,
    /** 已存但解不开（加密密钥变了）的字段 */
    unreadable: {
      apiKey: unreadable(s.apiKeyEnc),
      githubToken: unreadable(s.githubTokenEnc),
      phToken: unreadable(s.phTokenEnc),
    },
    keySource: keySource(),
    running: !!s.lockedUntil && s.lockedUntil > new Date(),
  };
}

export type SettingsView = Awaited<ReturnType<typeof getSettingsView>>;

export async function saveSettings(raw: unknown) {
  const parsed = agentSettingsSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  const v = parsed.data;
  if (!keySource() && (v.apiKey || v.githubToken || v.phToken)) {
    throw new DomainError("服务器未配置 AGENT_ENCRYPTION_KEY 或 AUTH_SECRET，无法加密保存密钥");
  }
  const secretPatch = (value: string, clear: boolean, enc: "apiKeyEnc" | "githubTokenEnc" | "phTokenEnc", tail: "apiKeyLast4" | "githubTokenLast4" | "phTokenLast4") => {
    if (value) return { [enc]: encryptSecret(value), [tail]: last4(value) };
    if (clear) return { [enc]: null, [tail]: null };
    return {};
  };
  await repo.updateSetting({
    baseUrl: v.baseUrl,
    model: v.model,
    maxPerRun: v.maxPerRun,
    cronEnabled: v.cronEnabled,
    srcMcpRegistry: v.srcMcpRegistry,
    srcGithub: v.srcGithub,
    srcAwesome: v.srcAwesome,
    srcHuggingface: v.srcHuggingface,
    srcProductHunt: v.srcProductHunt,
    ...secretPatch(v.apiKey, false, "apiKeyEnc", "apiKeyLast4"),
    ...secretPatch(v.githubToken, v.clearGithubToken, "githubTokenEnc", "githubTokenLast4"),
    ...secretPatch(v.phToken, v.clearPhToken, "phTokenEnc", "phTokenLast4"),
  });
  return { ok: true as const };
}

export type RuntimeConfig = {
  chat: ChatConfig;
  maxPerRun: number;
  sources: { mcpRegistry: boolean; github: boolean; awesome: boolean; huggingface: boolean; productHunt: boolean };
  githubToken: string | null;
  phToken: string | null;
};

/** 运行时配置（含解密后的密钥，仅在服务端内存里使用）。缺少必填项时抛 DomainError。 */
export async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const s = await repo.getSetting();
  if (!s.baseUrl || !s.model) throw new DomainError("请先在「采集 Agent」页填写模型 Base URL 和模型名");
  if (!s.apiKeyEnc) throw new DomainError("请先填写模型 API Key");
  const apiKey = decryptSecret(s.apiKeyEnc);
  if (!apiKey) throw new DomainError("已保存的 API Key 无法解密（加密密钥可能已更换），请重新填写");
  return {
    chat: { baseUrl: s.baseUrl, apiKey, model: s.model },
    maxPerRun: s.maxPerRun,
    sources: {
      mcpRegistry: s.srcMcpRegistry,
      github: s.srcGithub,
      awesome: s.srcAwesome,
      huggingface: s.srcHuggingface,
      productHunt: s.srcProductHunt,
    },
    githubToken: decryptSecret(s.githubTokenEnc),
    phToken: decryptSecret(s.phTokenEnc),
  };
}

/** 测试连接：让模型回复 ok。 */
export async function testConnection() {
  const cfg = await loadRuntimeConfig();
  try {
    const r = await chat(cfg.chat, [{ role: "user", content: "连接测试：请只回复 ok" }], { maxTokens: 10, timeoutMs: 20_000 });
    return { reply: r.content.trim().slice(0, 40) };
  } catch (e) {
    if (e instanceof LlmError) throw new DomainError(e.message);
    throw e;
  }
}
