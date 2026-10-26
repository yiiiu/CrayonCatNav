import "server-only";
import { applyTargetCategory, type GlobalSources } from "@/lib/agent/category-target";
import { buildUserPrompt, chat, LlmError, SYSTEM_PROMPT, type ChatMessage, type ChatUsage, type PromptContext } from "@/lib/agent/llm";
import { checkLink, fetchPreviewImage, safeFetch, SafeFetchError } from "@/lib/agent/safe-fetch";
import { isKnown, rawKeys, buildQueue } from "@/lib/agent/select";
import { fetchAwesome } from "@/lib/agent/sources/awesome";
import { fetchGithub, fetchGithubRepo } from "@/lib/agent/sources/github";
import { fetchHuggingface } from "@/lib/agent/sources/huggingface";
import { fetchMcpRegistry } from "@/lib/agent/sources/mcp-registry";
import { pageToRaw } from "@/lib/agent/sources/page";
import { fetchProductHunt } from "@/lib/agent/sources/producthunt";
import type { CandidateSource, RawCandidate } from "@/lib/agent/types";
import { githubRepoOf, isHttpsUrl, normalizeUrl, urlKeysOf } from "@/lib/agent/url";
import * as repo from "@/lib/data/agent.repo";
import { toolMetas } from "@/lib/tools/metas";
import { cleanModelOutput, extractJson, type CandidatePayload, type CleanContext } from "@/lib/validation/candidate";
import { parseStoredConfig } from "@/lib/validation/collect-config";
import { buildVocab } from "@/lib/validation/tag-vocab";
import { loadRuntimeConfig, type RuntimeConfig } from "./agent-settings.service";
import { resolveTarget, type CollectTarget } from "./category-collect.service";
import { DomainError } from "./result";

/**
 * 采集流程（按分类定向）：抢锁 → 确定目标分类（手动指定 / 自动选「已上架 + 待审核」最少的已配置分类）
 * → 只拉该分类配置里开启且全局也开启的来源（GitHub 按该分类的主题 / 关键词查询） → 规范化去重（现有资源 + 全部候选，含已拒绝）→ 模型整理（json_object + zod，失败重试一次）
 * → 链接可访问检查 → 存候选。永不自动上架。
 */

/** 锁的有效期略大于函数最长执行时间（300s），平台强杀后锁会自动过期。 */
const LOCK_TTL_MS = 330_000;
/** 超过这个时长不再开始处理新条目，给进行中的条目留出收尾时间。 */
const START_BUDGET_MS = 150_000;
const LLM_TIMEOUT_MS = 45_000;
const CONCURRENCY = 3;

export type RunSummary = {
  runId: string;
  status: "succeeded" | "failed";
  found: number;
  created: number;
  skipped: number;
  failed: number;
  error: string | null;
  message: string;
};

type Ctx = {
  cfg: RuntimeConfig;
  prompt: PromptContext;
  clean: CleanContext;
  known: Set<string>;
  usage: ChatUsage;
  runId: string;
  /** 目标分类；贴链接整理为空（不限分类） */
  target: CollectTarget | null;
};

type ItemOutcome = { kind: "created" | "skipped" | "duplicate" | "failed"; note?: string };

function addUsage(ctx: Ctx, u: ChatUsage | null) {
  if (!u) return;
  ctx.usage.promptTokens += u.promptTokens;
  ctx.usage.completionTokens += u.completionTokens;
}

/** 调模型并校验；不合格时把错误告诉模型重试一次，仍不合格则丢弃。 */
async function askModel(raw: RawCandidate, ctx: Ctx) {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: buildUserPrompt(raw, ctx.prompt) },
  ];
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat(ctx.cfg.chat, messages, { json: true, timeoutMs: LLM_TIMEOUT_MS, maxTokens: 1500 });
    addUsage(ctx, r.usage);
    let json: unknown;
    try {
      json = extractJson(r.content);
    } catch (e) {
      lastError = e instanceof Error ? e.message : "JSON 解析失败";
      messages.push({ role: "assistant", content: r.content.slice(0, 4000) }, { role: "user", content: `上次输出不合格：${lastError}。请修正后只输出一个 JSON 对象。` });
      continue;
    }
    const cleaned = cleanModelOutput(json, raw, ctx.clean);
    if (cleaned.ok) return cleaned;
    lastError = cleaned.error;
    messages.push({ role: "assistant", content: r.content.slice(0, 4000) }, { role: "user", content: `上次输出不合格：${lastError}。请修正后只输出一个 JSON 对象。` });
  }
  return { ok: false as const, error: lastError };
}

/** 链接检查：官网与 GitHub 分别检查；官网不通但 GitHub 通时去掉官网。Product Hunt 跳转链接换成最终落地地址。 */
async function verifyLinks(payload: CandidatePayload): Promise<{ payload: CandidatePayload; status: number | null; extraKeys: string[] } | null> {
  let { websiteUrl } = payload;
  const extraKeys: string[] = [];
  let status: number | null = null;
  if (websiteUrl) {
    const r = await checkLink(websiteUrl);
    status = r.status;
    if (r.ok && r.finalUrl && /(^|\.)producthunt\.com$/i.test(new URL(websiteUrl).hostname)) {
      // PH 的 /r/ 跳转：记下跳转链接的键防止再次推送，官网改用落地地址（落地仍在 PH 或非 https 就丢弃）
      extraKeys.push(...urlKeysOf(websiteUrl));
      const landing = new URL(r.finalUrl);
      landing.search = "";
      websiteUrl = isHttpsUrl(landing.toString()) && !/(^|\.)producthunt\.com$/i.test(landing.hostname) ? landing.toString() : null;
    } else if (!r.ok) {
      websiteUrl = null;
    }
  }
  if (payload.githubUrl) {
    const r = await checkLink(payload.githubUrl);
    if (status === null || !websiteUrl) status = r.status;
    if (!r.ok) {
      if (!websiteUrl) return null;
      return { payload: { ...payload, websiteUrl, githubUrl: null }, status, extraKeys };
    }
  }
  if (!websiteUrl && !payload.githubUrl) return null;
  return { payload: { ...payload, websiteUrl }, status, extraKeys };
}

async function processOne(raw: RawCandidate, ctx: Ctx): Promise<ItemOutcome> {
  const result = await askModel(raw, ctx);
  if (!result.ok) return { kind: "failed", note: `${raw.title}：模型输出不合格（${result.error}）` };
  if (result.skip) return { kind: "skipped", note: `${raw.title}：模型建议不收录（${result.reason.slice(0, 80)}）` };
  const judged = applyTargetCategory(result, ctx.target);

  const verified = await verifyLinks(result.payload);
  if (!verified) return { kind: "failed", note: `${raw.title}：链接不可访问` };
  const payload = verified.payload;

  const keys = [...new Set([...urlKeysOf(payload.githubUrl, payload.websiteUrl), ...rawKeys(raw), ...verified.extraKeys])];
  const primary = normalizeUrl(payload.githubUrl ?? payload.websiteUrl!)!;
  // 落地地址换了之后再查一次重复
  if (isKnown(urlKeysOf(payload.githubUrl, payload.websiteUrl), ctx.known)) {
    for (const k of keys) ctx.known.add(k);
    return { kind: "duplicate" };
  }
  for (const k of keys) ctx.known.add(k);
  // 详情页预览图：官网 og:image 优先，没有再用 GitHub 仓库的社交卡片
  payload.previewImageUrl = await fetchPreviewImage(payload.websiteUrl, payload.githubUrl);

  const saved = await repo.createCandidate({
    normalizedUrl: primary,
    urlKeys: keys,
    name: payload.name,
    source: raw.source,
    sourceUrl: raw.sourceUrl,
    stars: raw.stars,
    sourceUpdatedAt: raw.sourceUpdatedAt,
    rawSummary: raw.description.slice(0, 1000),
    payload,
    reason: judged.reason,
    confidence: judged.confidence,
    linkStatus: verified.status,
    runId: ctx.runId,
  });
  if (!saved) return { kind: "duplicate" };
  // 建议的新标签进待定池；记录失败不影响候选本身
  if (payload.suggestedTags.length) await repo.recordTagSuggestions(saved.id, payload.suggestedTags).catch(() => undefined);
  return { kind: "created" };
}

async function buildContext(cfg: RuntimeConfig, runId: string, target: CollectTarget | null): Promise<Ctx> {
  const [{ tags, tools }, cats, urls, closed] = await Promise.all([
    repo.loadTaxonomy(),
    repo.listCategoriesWithCollectConfig(),
    repo.loadKnownUrls(),
    repo.loadClosedSuggestions(),
  ]);
  // 分类说明来自分类采集配置，帮助模型判断归类
  const categories = cats.map((c) => ({ slug: c.slug, name: c.name, description: parseStoredConfig(c.rawConfig)?.description ?? "" }));
  if (categories.length === 0) throw new DomainError("还没有任何分类，请先在「分类标签」里新增");
  // 工具以代码注册表为准，并与 Tool 表取交集
  const toolList = toolMetas.filter((m) => tools.some((t) => t.slug === m.slug)).map((m) => ({ slug: m.slug, name: m.name, description: m.description }));
  const known = new Set<string>();
  for (const r of urls.resources) for (const k of urlKeysOf(r.websiteUrl, r.githubUrl)) known.add(k);
  for (const c of urls.candidates) {
    known.add(c.normalizedUrl);
    for (const k of c.urlKeys) known.add(k);
  }
  return {
    cfg,
    runId,
    target,
    known,
    usage: { promptTokens: 0, completionTokens: 0 },
    prompt: {
      categories,
      target: target ? { slug: target.slug, name: target.name, description: target.config.description } : null,
      tagNames: tags.map((t) => t.name),
      tools: toolList,
    },
    clean: { categorySlugs: categories.map((c) => c.slug), tags: buildVocab(tags, closed), toolSlugs: toolList.map((t) => t.slug) },
  };
}

type SourceNote = { source: CandidateSource; fetched: number; error?: string };

/** 只跑目标分类配置里开启、且全局开关也开启的来源（target.active 已取交集）。 */
async function gatherSources(cfg: RuntimeConfig, target: CollectTarget): Promise<{ pools: RawCandidate[][]; notes: SourceNote[] }> {
  const c = target.config;
  const tasks: [CandidateSource, () => Promise<RawCandidate[]>][] = [];
  const on = new Set(target.active);
  if (on.has("mcpRegistry")) tasks.push(["mcp_registry", () => fetchMcpRegistry()]);
  if (on.has("github")) {
    const params = { topics: c.githubTopics, keywords: c.githubKeywords, minStars: c.githubMinStars, newMinStars: c.githubNewMinStars };
    tasks.push(["github", () => fetchGithub(params, cfg.githubToken)]);
  }
  if (on.has("awesome")) tasks.push(["awesome", () => fetchAwesome()]);
  if (on.has("huggingface")) tasks.push(["huggingface", () => fetchHuggingface(c.hfSearch)]);
  const notes: SourceNote[] = [];
  if (on.has("productHunt") && cfg.phToken) tasks.push(["producthunt", () => fetchProductHunt(cfg.phToken!)]);
  else if (c.sources.productHunt && cfg.sources.productHunt && !cfg.phToken) notes.push({ source: "producthunt", fetched: 0, error: "未配置 Product Hunt Token，已跳过" });
  const results = await Promise.allSettled(tasks.map(([, fn]) => fn()));
  const pools: RawCandidate[][] = [];
  results.forEach((r, i) => {
    const source = tasks[i][0];
    if (r.status === "fulfilled") {
      pools.push(r.value);
      notes.push({ source, fetched: r.value.length });
    } else {
      notes.push({ source, fetched: 0, error: r.reason instanceof Error ? r.reason.message.slice(0, 200) : "拉取失败" });
    }
  });
  return { pools, notes };
}

/** 全局来源开关（目标分类的来源要与它取交集）。Product Hunt 需要已配置 Token。 */
export function globalSourcesOf(cfg: RuntimeConfig): GlobalSources {
  return {
    github: cfg.sources.github,
    mcpRegistry: cfg.sources.mcpRegistry,
    awesome: cfg.sources.awesome,
    huggingface: cfg.sources.huggingface,
    productHunt: cfg.sources.productHunt && !!cfg.phToken,
  };
}

/** 用工作池处理队列：并发 3，新增数到上限、队列耗尽或超出时间预算即停。 */
async function processQueue(queue: RawCandidate[], ctx: Ctx, limit: number, startedAt: number) {
  const counts = { created: 0, skipped: 0, failed: 0, duplicates: 0 };
  const notes: string[] = [];
  let next = 0;
  let inFlight = 0;
  let llmErrors = 0;
  let fatal: string | null = null;
  const worker = async () => {
    while (!fatal && next < queue.length && counts.created + inFlight < limit && Date.now() - startedAt < START_BUDGET_MS) {
      const item = queue[next++];
      inFlight++;
      try {
        const o = await processOne(item, ctx);
        if (o.kind === "created") counts.created++;
        else if (o.kind === "skipped") counts.skipped++;
        else if (o.kind === "duplicate") counts.duplicates++;
        else counts.failed++;
        if (o.note) notes.push(o.note);
        if (o.kind !== "failed") llmErrors = 0;
      } catch (e) {
        counts.failed++;
        const msg = e instanceof Error ? e.message : "未知错误";
        notes.push(`${item.title}：${msg.slice(0, 160)}`);
        if (e instanceof LlmError) {
          llmErrors++;
          // 连续 3 次模型接口错误（多为 Key/地址/模型名配置问题）就停止，避免白跑
          if (llmErrors >= 3) fatal = `模型接口连续出错：${msg}`;
        }
      } finally {
        inFlight--;
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { counts, notes, fatal };
}

export type TargetChoice = "auto" | { categoryId: string };

async function withRun(
  trigger: "manual" | "cron" | "link",
  choice: TargetChoice | null,
  body: (ctx: Ctx, startedAt: number) => Promise<Omit<RunSummary, "runId" | "message"> & { notes: unknown }>,
): Promise<RunSummary> {
  const cfg = await loadRuntimeConfig();
  if (!(await repo.acquireLock(LOCK_TTL_MS))) throw new DomainError("已有采集正在进行，请等它结束后再试");
  const startedAt = Date.now();
  let runId = "";
  try {
    await repo.failStaleRuns(new Date(startedAt - LOCK_TTL_MS));
    // 抢到锁之后再选目标分类，计数不会被并发采集打乱
    const target = choice ? await resolveTarget(choice, globalSourcesOf(cfg)) : null;
    runId = (await repo.createRun(trigger, target?.id ?? null)).id;
    const ctx = await buildContext(cfg, runId, target);
    const r = await body(ctx, startedAt);
    await repo.finishRun(runId, {
      status: r.status,
      found: r.found,
      created: r.created,
      skipped: r.skipped,
      failed: r.failed,
      error: r.error,
      notes: JSON.parse(JSON.stringify(r.notes ?? null)),
      promptTokens: ctx.usage.promptTokens || null,
      completionTokens: ctx.usage.completionTokens || null,
    });
    const message =
      r.status === "failed"
        ? `采集失败：${r.error ?? "未知错误"}`
        : `${ctx.target ? `「${ctx.target.name}」` : ""}采集完成：发现 ${r.found} 条，新增候选 ${r.created} 条，跳过 ${r.skipped} 条，失败 ${r.failed} 条`;
    return { runId, ...r, message };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "未知错误";
    if (runId) await repo.finishRun(runId, { status: "failed", found: 0, created: 0, skipped: 0, failed: 0, error: msg.slice(0, 500) }).catch(() => undefined);
    if (e instanceof DomainError) throw e;
    throw new DomainError(`采集失败：${msg.slice(0, 200)}`);
  } finally {
    await repo.releaseLock().catch(() => undefined);
  }
}

/** 为目标分类采集一轮：手动可指定分类或自动；定时固定自动（选资源最少的已配置分类）。 */
export function runCollection(trigger: "manual" | "cron", choice: TargetChoice = "auto") {
  return withRun(trigger, trigger === "cron" ? "auto" : choice, async (ctx, startedAt) => {
    const target = ctx.target!;
    const targetNote = { slug: target.slug, name: target.name, mode: target.mode, ...(target.snapshot ? { snapshot: target.snapshot } : {}) };
    const { pools, notes: sourceNotes } = await gatherSources(ctx.cfg, target);
    const found = pools.reduce((n, p) => n + p.length, 0);
    if (sourceNotes.length === 0) {
      return { status: "failed", found: 0, created: 0, skipped: 0, failed: 0, error: "没有开启任何采集来源", notes: { target: targetNote, sources: sourceNotes } };
    }
    if (pools.length === 0) {
      return { status: "failed", found: 0, created: 0, skipped: 0, failed: 0, error: "所有来源都拉取失败", notes: { target: targetNote, sources: sourceNotes } };
    }
    const { queue, duplicates } = buildQueue(pools, ctx.known);
    const { counts, notes, fatal } = await processQueue(queue, ctx, ctx.cfg.maxPerRun, startedAt);
    const skipped = duplicates + counts.duplicates + counts.skipped;
    return {
      status: fatal && counts.created === 0 ? "failed" : "succeeded",
      found,
      created: counts.created,
      skipped,
      failed: counts.failed,
      error: fatal,
      notes: { target: targetNote, sources: sourceNotes, items: notes.slice(0, 40), duplicates: duplicates + counts.duplicates, unprocessed: Math.max(0, queue.length - counts.created - counts.skipped - counts.failed - counts.duplicates) },
    };
  });
}

/** 管理员贴一个链接让 Agent 整理成候选（同样去重、防 SSRF、人工审核）。 */
export function collectLink(url: string) {
  return withRun("link", null, async (ctx) => {
    const repoPath = githubRepoOf(url);
    let raw: RawCandidate | null;
    try {
      if (repoPath) {
        raw = await fetchGithubRepo(repoPath, ctx.cfg.githubToken);
        if (!raw) throw new DomainError("这个 GitHub 仓库已归档、是 fork 或不可访问");
      } else {
        const page = await safeFetch(url, { maxBytes: 600_000 });
        if (page.status >= 400) throw new DomainError(`页面返回 HTTP ${page.status}`);
        if (!/html|text\/plain/i.test(page.contentType)) throw new DomainError("只支持网页链接");
        raw = pageToRaw(page.body, page.finalUrl);
      }
    } catch (e) {
      if (e instanceof DomainError || e instanceof SafeFetchError) {
        return { status: "failed", found: 0, created: 0, skipped: 0, failed: 1, error: e.message, notes: null };
      }
      throw e;
    }
    if (isKnown(rawKeys(raw), ctx.known)) {
      return { status: "succeeded", found: 1, created: 0, skipped: 1, failed: 0, error: null, notes: { items: ["该链接已在资源库或候选箱中（含已拒绝）"] } };
    }
    const o = await processOne(raw, ctx);
    return {
      status: "succeeded",
      found: 1,
      created: o.kind === "created" ? 1 : 0,
      skipped: o.kind === "skipped" || o.kind === "duplicate" ? 1 : 0,
      failed: o.kind === "failed" ? 1 : 0,
      error: o.kind === "failed" ? (o.note ?? "整理失败") : null,
      notes: o.note ? { items: [o.note] } : null,
    };
  });
}
