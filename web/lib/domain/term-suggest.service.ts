import "server-only";
import { chat, LlmError, type ChatConfig, type ChatMessage } from "@/lib/agent/llm";
import { termHitsBatch } from "@/lib/agent/term-hits";
import { buildDescriptionPrompt, buildTermPrompt, DESCRIPTION_SYSTEM_PROMPT, parseDescriptionOutput, TERM_SYSTEM_PROMPT, type TermContext } from "@/lib/agent/term-prompt";
import {
  applyHits,
  candidateCap,
  classifyTerms,
  finalizeTerms,
  MAX_UNAUTH_CHECKS,
  parseTermOutput,
  splitFieldValue,
  TERM_RULES_VERSION,
  termFields,
  type ClassifiedTerm,
  type TermField,
} from "@/lib/agent/term-rules";
import * as repo from "@/lib/data/agent.repo";
import { extractJson } from "@/lib/validation/candidate";
import { parseStoredConfig } from "@/lib/validation/collect-config";
import { loadRuntimeConfig } from "./agent-settings.service";
import { DomainError } from "./result";

/**
 * 分类采集配置的 AI 扩词（规格 docs/spec/采集关键词AI扩词与来源扩展方案.md §4）。
 * 只返回建议，不写库；界面点选后由管理员保存。
 */

const LLM_TIMEOUT_MS = 45_000;
const RESULT_CACHE_MS = 10 * 60_000;

/** 界面传来的表单当前值（未保存的也算）。 */
export type TermDraft = Partial<Record<TermField | "description" | "githubNewMinStars", string>>;

export type TermSuggestion = { items: ClassifiedTerm[]; checked: boolean; version: string };

const resultCache = new Map<string, { at: number; value: TermSuggestion }>();

async function loadContext(categoryId: string, draft: TermDraft): Promise<TermContext> {
  const [cats, samples] = await Promise.all([repo.listCategoriesWithCollectConfig(), repo.listCategorySamples(categoryId)]);
  const me = cats.find((c) => c.id === categoryId);
  if (!me) throw new DomainError("分类不存在或已删除，请刷新页面");
  const current = Object.fromEntries(termFields.map((f) => [f, splitFieldValue(f, draft[f] ?? "")])) as Record<TermField, string[]>;
  const others = cats
    .filter((c) => c.id !== categoryId)
    .map((c) => {
      const cfg = c.rawConfig === null ? null : parseStoredConfig(c.rawConfig);
      return {
        name: c.name,
        description: cfg?.description ?? "",
        terms: { githubTopics: cfg?.githubTopics ?? [], githubKeywords: cfg?.githubKeywords ?? [], hfSearch: cfg?.hfSearch ?? [] },
      };
    });
  return { category: { slug: me.slug, name: me.name, description: (draft.description ?? "").trim() }, samples, current, others };
}

async function askJson(cfg: ChatConfig, system: string, prompt: string, maxTokens: number): Promise<unknown> {
  const messages: ChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: prompt },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat(cfg, messages, { json: true, maxTokens, timeoutMs: LLM_TIMEOUT_MS });
    try {
      return extractJson(r.content);
    } catch {
      messages.push({ role: "assistant", content: r.content.slice(0, 3000) }, { role: "user", content: "上次输出不是合法 JSON，请只输出一个 JSON 对象。" });
    }
  }
  throw new LlmError("模型两次都没有输出合法 JSON");
}

const wrapLlm = async <T>(fn: () => Promise<T>): Promise<T> => {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof LlmError) throw new DomainError(e.message);
    throw e;
  }
};

export async function suggestTerms(categoryId: string, field: TermField, draft: TermDraft): Promise<TermSuggestion> {
  if (!termFields.includes(field)) throw new DomainError("不支持的字段");
  const cacheKey = JSON.stringify([categoryId, field, draft]);
  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RESULT_CACHE_MS) return cached.value;

  const runtime = await loadRuntimeConfig();
  const ctx = await loadContext(categoryId, draft);
  const cap = candidateCap(field, ctx.current[field].length);
  const raw = await wrapLlm(async () => parseTermOutput(await askJson(runtime.chat, TERM_SYSTEM_PROMPT, buildTermPrompt(ctx, field, Math.min(15, cap + 3)), 1500)));
  if (raw.length === 0) throw new DomainError("模型没有给出可用的候选词，请稍后再试");

  // 先跑不联网的规则，再只对「推荐」的候选查命中数，最后排序截断
  const classified = classifyTerms(raw, { field, existing: ctx.current[field], others: ctx.others.map((o) => ({ name: o.name, terms: o.terms[field] })) });
  const toCheck = classified.filter((t) => t.status === "ok").slice(0, cap);
  const minStars = Math.max(0, Number(draft.githubNewMinStars) || 100);
  const hits = await termHitsBatch(
    field,
    toCheck.map((t) => t.term),
    { minStars, githubToken: runtime.githubToken, maxUnauth: MAX_UNAUTH_CHECKS },
  );
  const hitByTerm = new Map(toCheck.map((t, i) => [t.term, hits[i]]));
  const items = finalizeTerms(
    classified.map((t) => (hitByTerm.has(t.term) ? applyHits(t, hitByTerm.get(t.term)?.hits ?? null, field, hitByTerm.get(t.term)?.capped) : t)),
    cap,
  );
  const value = { items, checked: hits.some((h) => h !== null), version: TERM_RULES_VERSION };
  resultCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

export async function suggestDescription(categoryId: string, draft: TermDraft): Promise<string> {
  const runtime = await loadRuntimeConfig();
  const ctx = await loadContext(categoryId, draft);
  const text = await wrapLlm(async () => parseDescriptionOutput(await askJson(runtime.chat, DESCRIPTION_SYSTEM_PROMPT, buildDescriptionPrompt(ctx), 900)));
  if (!text) throw new DomainError("模型没有给出分类说明，请稍后再试");
  return text;
}
