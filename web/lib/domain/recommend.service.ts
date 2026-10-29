import "server-only";
import { createHmac } from "node:crypto";
import { checkBudget } from "@/lib/agent/budget";
import { LlmError } from "@/lib/agent/llm";
import * as agentRepo from "@/lib/data/agent.repo";
import { getRecommendCache, purgeExpiredRecommendCache, setRecommendCache } from "@/lib/data/recommend.repo";
import { listRecommendCatalog, type RecommendCatalogRow } from "@/lib/data/resource.repo";
import { normalizeQuery, prefilter } from "@/lib/recommend/prefilter";
import { buildRecommendPrompt, parseRecommendOutput, RECOMMEND_SYSTEM_PROMPT, validateQuery } from "@/lib/recommend/prompt";
import { GLOBAL_SUBJECT, hitAll, RECOMMEND_IP_DAY, RECOMMEND_IP_MIN, recommendGlobalDay } from "@/lib/security/rate-limit";
import { extractJson } from "@/lib/validation/candidate";
import { loadRuntimeConfig } from "./agent-settings.service";
import { budgetSettingsOf, monthUsage, trackedChat } from "./model-budget.service";
import { DomainError } from "./result";

/**
 * 前台推荐 Agent（规格 docs/spec/前台推荐Agent方案.md）：
 * 校验 → 限流 → 粗筛 → 缓存 → 花费检查 → 模型排序 → 校验 → 记用量；任何模型侧问题都降级为粗筛结果。
 * 不记录访客输入：不写日志、不进 URL，缓存只存 HMAC 哈希。
 */

const CANDIDATES = 30;
const FALLBACK_COUNT = 5;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const LLM_TIMEOUT_MS = 20_000;
const PURGE_CHANCE = 0.02;

export type RecommendItem = {
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  category: { slug: string; name: string };
  tags: { tag: { id: string; name: string } }[];
  tools: string[];
  reason: string;
};

export type RecommendResponse =
  | { ok: true; mode: "ai" | "fallback"; items: RecommendItem[]; note?: string; notice?: string }
  | { ok: false; code: "invalid_input" | "disabled" | "rate_limited"; message: string; retryAfterSec?: number };

type Cached = { picks: { slug: string; reason: string }[]; note: string };

function toItem(r: RecommendCatalogRow, reason: string): RecommendItem {
  return {
    slug: r.slug,
    name: r.name,
    summary: r.summary,
    websiteUrl: r.websiteUrl,
    githubUrl: r.githubUrl,
    category: r.category,
    tags: r.tags.slice(0, 4).map(({ tag }) => ({ tag: { id: tag.id, name: tag.name } })),
    tools: r.tools,
    reason,
  };
}

const cacheKey = (q: string) => `rec:${createHmac("sha256", process.env.AUTH_SECRET ?? "").update(normalizeQuery(q)).digest("hex").slice(0, 40)}`;

/** 缓存结果映射回当前目录：已下架的资源过滤掉。 */
function fromCache(c: Cached, bySlug: Map<string, RecommendCatalogRow>): RecommendResponse {
  const items = c.picks.flatMap((p) => (bySlug.has(p.slug) ? [toItem(bySlug.get(p.slug)!, p.reason)] : []));
  return { ok: true, mode: "ai", items, ...(c.note ? { note: c.note } : {}) };
}

function readCached(v: unknown): Cached | null {
  if (!v || typeof v !== "object" || !Array.isArray((v as Cached).picks)) return null;
  return v as Cached;
}

export async function recommend(raw: unknown, ip: string): Promise<RecommendResponse> {
  const q = validateQuery(raw);
  if (!q) return { ok: false, code: "invalid_input", message: "请用 2–200 字描述你想做的事" };

  const setting = await agentRepo.getSetting();
  if (!setting.recommendEnabled) return { ok: false, code: "disabled", message: "AI 推荐暂未开放" };

  const limit = await hitAll([
    [RECOMMEND_IP_MIN, ip],
    [RECOMMEND_IP_DAY, ip],
    [recommendGlobalDay(setting.recommendDailyCap), GLOBAL_SUBJECT],
  ]);
  if (!limit.ok) {
    const wait = limit.retryAfterSec;
    const text = wait <= 90 ? `${wait} 秒` : wait < 3600 ? `${Math.ceil(wait / 60)} 分钟` : `${Math.ceil(wait / 3600)} 小时`;
    return { ok: false, code: "rate_limited", message: `问得太快了，请 ${text}后再试`, retryAfterSec: wait };
  }
  if (Math.random() < PURGE_CHANCE) void purgeExpiredRecommendCache().catch(() => {});

  const catalog = await listRecommendCatalog();
  const bySlug = new Map(catalog.map((r) => [r.slug, r]));
  const pre = prefilter(catalog.map((r) => ({ ...r, tags: r.tags.map(({ tag }) => tag) })), q, CANDIDATES);
  const fallback = (notice: string): RecommendResponse => ({
    ok: true,
    mode: "fallback",
    items: pre.items.slice(0, FALLBACK_COUNT).flatMap((c) => (bySlug.has(c.slug) ? [toItem(bySlug.get(c.slug)!, "")] : [])),
    notice: pre.matched > 0 ? `${notice}，先看看这些相关资源` : `${notice}，先看看这些精选资源`,
  });

  const key = cacheKey(q);
  const cached = readCached(await getRecommendCache(key));
  if (cached) return fromCache(cached, bySlug);

  if (!checkBudget("recommend", await monthUsage(), budgetSettingsOf(setting)).ok) return fallback("AI 推荐本月额度已用完");

  let cfg;
  try {
    cfg = await loadRuntimeConfig();
  } catch (e) {
    if (e instanceof DomainError) return fallback("AI 推荐暂时不可用");
    throw e;
  }

  let parsed: ReturnType<typeof parseRecommendOutput> = null;
  try {
    const r = await trackedChat(
      "recommend",
      cfg.chat,
      [
        { role: "system", content: RECOMMEND_SYSTEM_PROMPT },
        { role: "user", content: buildRecommendPrompt(q, pre.items) },
      ],
      { json: true, maxTokens: 600, timeoutMs: LLM_TIMEOUT_MS },
    );
    let json: unknown = null;
    try {
      json = extractJson(r.content);
    } catch {
      /* 不是合法 JSON：走降级 */
    }
    parsed = parseRecommendOutput(json, pre.items.length);
  } catch (e) {
    if (!(e instanceof LlmError)) throw e;
  }
  if (!parsed) return fallback("AI 推荐暂时不可用");

  const result: Cached = { picks: parsed.picks.map((p) => ({ slug: pre.items[p.index].slug, reason: p.reason })), note: parsed.note };
  await setRecommendCache(key, result, CACHE_TTL_MS).catch(() => {});
  return fromCache(result, bySlug);
}
