import "server-only";
import {
  applyFixes,
  buildReviewPrompt,
  countExistingTags,
  decide,
  parseReviewOutput,
  REVIEW_SYSTEM_PROMPT,
  runRules,
  type Decision,
  type ReviewModelResult,
  type ReviewNotes,
  readReviewNotes,
} from "@/lib/agent/review";
import type { ChatConfig, ChatMessage } from "@/lib/agent/llm";
import { checkLink, fetchEnrichMaterial } from "@/lib/agent/safe-fetch";
import { urlKeysOf } from "@/lib/agent/url";
import { statDay } from "@/lib/analytics/traffic";
import * as repo from "@/lib/data/agent.repo";
import { candidatePayloadSchema, extractJson, type CandidatePayload } from "@/lib/validation/candidate";
import { parseStoredConfig } from "@/lib/validation/collect-config";
import { loadRuntimeConfig } from "./agent-settings.service";
import { convertCandidate, rejectCandidate } from "./candidate.service";
import { assertBudget, trackedChat } from "./model-budget.service";
import { DomainError } from "./result";

/** 审核 Agent：规则检查 + 模型复核 + 按模式处理。规格 docs/spec/审核Agent方案.md。 */

const LLM_TIMEOUT_MS = 45_000;
/** 批量审核的时间预算（Vercel 函数最长 300 秒，留余量） */
const BATCH_DEADLINE_MS = 240_000;
const REVIEW_LOCK_TTL_MS = 330_000;

type Setting = Awaited<ReturnType<typeof repo.getSetting>>;

type Ctx = {
  setting: Setting;
  chat: ChatConfig | null;
  categories: { slug: string; name: string; description: string }[];
  tagNames: string[];
  tagByName: Map<string, string>;
  knownResources: { name: string; keys: string[] }[];
  /** 本批次开始前今天已自动上架的数量，批内累加 */
  todayAutoPublished: number;
};

async function buildCtx(requireModel: boolean): Promise<Ctx> {
  const setting = await repo.getSetting();
  let chat: ChatConfig | null = null;
  try {
    chat = (await loadRuntimeConfig()).chat;
  } catch (e) {
    if (requireModel) throw e;
  }
  const [{ tags }, cats, urls] = await Promise.all([repo.loadTaxonomy(), repo.listCategoriesWithCollectConfig(), repo.reviewLookups.resourceUrls()]);
  const tagByName = new Map<string, string>();
  for (const t of tags) tagByName.set(t.name.toLowerCase(), t.name);
  for (const t of tags) for (const a of t.aliases) if (!tagByName.has(a.toLowerCase())) tagByName.set(a.toLowerCase(), t.name);
  const todayStart = new Date(statDay().getTime() - 8 * 3_600_000); // 北京时间今天 00:00
  return {
    setting,
    chat,
    categories: cats.map((c) => ({ slug: c.slug, name: c.name, description: parseStoredConfig(c.rawConfig)?.description ?? "" })),
    tagNames: tags.map((t) => t.name),
    tagByName,
    knownResources: urls.map((r) => ({ name: r.name, keys: urlKeysOf(r.websiteUrl, r.githubUrl) })),
    todayAutoPublished: await repo.countAiPublishedSince(todayStart),
  };
}

/** 链接检查失败重试一次，避免网络抖动把好资源误判为「链接全挂」。 */
async function linkAlive(url: string | null): Promise<boolean | null> {
  if (!url) return null;
  if ((await checkLink(url)).ok) return true;
  return (await checkLink(url)).ok;
}

async function askModel(chat: ChatConfig, prompt: string): Promise<ReviewModelResult | null> {
  const messages: ChatMessage[] = [
    { role: "system", content: REVIEW_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await trackedChat("review", chat, messages, { json: true, maxTokens: 1500, timeoutMs: LLM_TIMEOUT_MS });
    let parsed: ReviewModelResult | null = null;
    try {
      parsed = parseReviewOutput(extractJson(r.content));
    } catch {
      parsed = null;
    }
    if (parsed) return parsed;
    messages.push({ role: "assistant", content: r.content.slice(0, 3000) }, { role: "user", content: "上次输出不符合要求，请只输出一个符合格式的 JSON 对象。" });
  }
  return null;
}

/** 候选 → 人工审核表单同样的输入（只用现有标签，不自动新建标签）。 */
const reviewInputOf = (p: CandidatePayload) => ({ name: p.name, slug: p.slug, summary: p.summary, categorySlug: p.categorySlug, tags: p.tags.join("，") });

export type ReviewOutcome = { id: string; name: string; action: Decision["action"] | "failed"; verdict: Decision["verdict"] | null; score: number | null; slug?: string; note?: string };

async function reviewWithCtx(id: string, ctx: Ctx): Promise<ReviewOutcome> {
  const cand = await repo.findCandidate(id);
  if (!cand) throw new DomainError("候选不存在或已删除");
  if (cand.status !== "pending") throw new DomainError("这条候选已处理过了");
  const parsed = candidatePayloadSchema.safeParse(cand.payload);
  const payload = parsed.success ? parsed.data : null;

  const [website, github] = await Promise.all([linkAlive(payload?.websiteUrl ?? null), linkAlive(payload?.githubUrl ?? null)]);
  const keys = new Set(payload ? urlKeysOf(payload.websiteUrl, payload.githubUrl) : []);
  const dup = ctx.knownResources.find((r) => r.keys.some((k) => keys.has(k)));
  const rules = runRules({
    payload,
    links: { website, github },
    duplicateOf: dup?.name ?? null,
    categoryExists: !!payload && ctx.categories.some((c) => c.slug === payload.categorySlug),
    existingTagCount: payload ? countExistingTags(payload.tags, ctx.tagByName) : 0,
    confidence: cand.confidence,
    sourceUpdatedAt: cand.sourceUpdatedAt,
    now: new Date(),
  });

  // 有硬伤就不花模型钱
  let model: ReviewModelResult | null = null;
  let error: string | undefined;
  if (rules.hard.length === 0 && payload) {
    if (!ctx.chat) error = "模型未配置，只做了规则检查";
    else {
      try {
        await assertBudget("review", ctx.setting);
        const material = await fetchEnrichMaterial(payload.websiteUrl, payload.githubUrl);
        if (!material.site && !material.readme) error = "官网和 README 都抓不到，无法核实";
        else model = await askModel(ctx.chat, buildReviewPrompt(payload, material, ctx));
        if (!model && !error) error = "模型两次都没有给出合法结论";
      } catch (e) {
        error = e instanceof Error ? e.message.slice(0, 200) : "模型调用失败";
      }
    }
  }

  // 应用修正后再按修正后的分类做新分类保护
  let fixed = payload;
  let applied: string[] = [];
  if (payload && model) {
    ({ payload: fixed, applied } = applyFixes(payload, model.fixes, { categorySlugs: new Set(ctx.categories.map((c) => c.slug)), tagByName: ctx.tagByName }));
  }
  const s = ctx.setting;
  const decision = decide({
    rules,
    model,
    confidence: cand.confidence,
    settings: { mode: s.reviewMode, approveScore: s.reviewApproveScore, rejectScore: s.reviewRejectScore, publishDraft: s.reviewPublishDraft, dailyCap: s.reviewDailyPublishCap },
    todayAutoPublished: ctx.todayAutoPublished,
    categoryPublished: fixed ? await repo.countPublishedInCategory(fixed.categorySlug) : 0,
  });

  const notes: ReviewNotes = {
    rules: [...rules.hard, ...rules.soft],
    issues: model?.issues ?? [],
    reason: model?.reason ?? "",
    why: decision.why,
    action: decision.action,
    applied,
    fixes: model?.fixes ?? {},
    ...(error ? { error } : {}),
  };
  const score = model?.score ?? null;
  // 先记结论；处理失败时结论仍在，留给人工
  await repo.saveReview(id, { verdict: decision.verdict, score, notes });

  const out: ReviewOutcome = { id, name: cand.name, action: decision.action, verdict: decision.verdict, score };
  try {
    if (decision.action === "reject") await rejectCandidate(id, "ai");
    else if ((decision.action === "publish" || decision.action === "draft") && fixed) {
      if (applied.length) await repo.updateCandidatePayload(id, fixed, fixed.name);
      const r = await convertCandidate(id, decision.action, reviewInputOf(fixed), "ai");
      out.slug = r.slug;
      ctx.todayAutoPublished++;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "处理失败";
    await repo.saveReview(id, { verdict: decision.verdict, score, notes: { ...notes, action: "human", error: `自动处理失败：${msg}` } });
    return { ...out, action: "human", note: msg };
  }
  return out;
}

/** 后台「AI 审核」单条：不管模式，都写结论；自动模式下照常处理。 */
export async function reviewOne(id: string): Promise<ReviewOutcome> {
  const ctx = await buildCtx(true);
  return reviewWithCtx(id, ctx);
}

const actionText = { publish: "已自动发布", draft: "已自动存草稿", reject: "已自动拒绝", human: "留给人工", failed: "留给人工" } as const;

/** 单条审核的结果说明（候选箱「上次 AI 审核」显示）。 */
export function outcomeMessage(o: ReviewOutcome): string {
  const verdict = o.verdict ? { approve: "建议上架", reject: "建议拒绝", unsure: "需人工" }[o.verdict] : "无结论";
  return `「${o.name}」${verdict}${o.score !== null ? `（${o.score} 分）` : ""}，${actionText[o.action]}`;
}

/** 后台单条审核：action 里检查并抢锁，审核本身放到 after() 里跑，页面可以随意切换。 */
export async function startReviewOne(id: string) {
  await loadRuntimeConfig();
  const cand = await repo.findCandidate(id);
  if (!cand) throw new DomainError("候选不存在或已删除");
  if (cand.status !== "pending") throw new DomainError("这条候选已处理过了");
  if (!(await repo.acquireReviewLock(REVIEW_LOCK_TTL_MS))) throw new DomainError("AI 审核正在进行，请等它结束");
}

/** startReviewOne 抢到锁之后调用：审核一条并释放锁、记下结果。 */
export async function reviewOneHeld(id: string): Promise<ReviewOutcome | null> {
  let msg = "";
  try {
    const o = await reviewOne(id);
    msg = outcomeMessage(o);
    return o;
  } catch (e) {
    msg = `失败：${e instanceof Error ? e.message.slice(0, 200) : "未知错误"}`;
    return null;
  } finally {
    await repo.finishReviewRun(msg).catch(() => undefined);
  }
}

export type ReviewBatchResult = {
  skipped?: string;
  reviewed: number;
  published: number;
  drafted: number;
  rejected: number;
  human: number;
  failed: number;
  remaining: number;
  slugs: string[];
};


/**
 * 后台手动批量审核：在 action 里先检查模型配置并抢锁（错误能立即显示），
 * 审核本身放到响应之后（after）运行，页面可以随意切换。
 */
export async function startReviewBatch() {
  await loadRuntimeConfig();
  if ((await repo.countUnreviewedPending()) === 0) throw new DomainError("没有需要审核的候选");
  if (!(await repo.acquireReviewLock(REVIEW_LOCK_TTL_MS))) throw new DomainError("AI 审核正在进行，请等它结束");
}

/** 批量审核未审过的待审核候选（cron 与后台按钮共用）；lockHeld 表示调用方已抢到锁。 */
export async function reviewPending(trigger: "cron" | "manual", lockHeld = false): Promise<ReviewBatchResult> {
  const empty: ReviewBatchResult = { reviewed: 0, published: 0, drafted: 0, rejected: 0, human: 0, failed: 0, remaining: 0, slugs: [] };
  const setting = await repo.getSetting();
  if (setting.reviewMode === "off" && trigger === "cron") return { ...empty, skipped: "审核 Agent 已在后台关闭" };
  if (!lockHeld && !(await repo.acquireReviewLock(REVIEW_LOCK_TTL_MS))) return { ...empty, skipped: "AI 审核正在进行" };
  let result: ReviewBatchResult = empty;
  let error: string | null = null;
  try {
    result = await runBatch(trigger, setting);
    return result;
  } catch (e) {
    error = e instanceof Error ? e.message : "未知错误";
    throw e;
  } finally {
    await repo.finishReviewRun(error ? `失败：${error}` : batchMessage(result)).catch(() => undefined);
  }
}

async function runBatch(trigger: "cron" | "manual", setting: Setting): Promise<ReviewBatchResult> {
  const empty: ReviewBatchResult = { reviewed: 0, published: 0, drafted: 0, rejected: 0, human: 0, failed: 0, remaining: 0, slugs: [] };
  const ctx = await buildCtx(trigger === "manual");
  const started = Date.now();
  const list = await repo.listUnreviewedPending(Math.max(1, setting.reviewMaxPerRun));
  const r = { ...empty };
  for (const { id } of list) {
    if (Date.now() - started > BATCH_DEADLINE_MS) break;
    try {
      const o = await reviewWithCtx(id, ctx);
      r.reviewed++;
      if (o.action === "publish") r.published++;
      else if (o.action === "draft") r.drafted++;
      else if (o.action === "reject") r.rejected++;
      else r.human++;
      if (o.slug) r.slugs.push(o.slug);
    } catch {
      r.failed++;
    }
  }
  r.remaining = await repo.countUnreviewedPending();
  return r;
}

export function batchMessage(r: ReviewBatchResult): string {
  if (r.skipped) return r.skipped;
  if (r.reviewed === 0 && r.failed === 0) return "没有需要审核的候选";
  const parts = [`审核 ${r.reviewed} 条`];
  if (r.published) parts.push(`自动发布 ${r.published}`);
  if (r.drafted) parts.push(`进草稿 ${r.drafted}`);
  if (r.rejected) parts.push(`自动拒绝 ${r.rejected}`);
  if (r.human) parts.push(`留人工 ${r.human}`);
  if (r.failed) parts.push(`失败 ${r.failed}`);
  if (r.remaining) parts.push(`还剩 ${r.remaining} 条未审`);
  return parts.join("，");
}

/** 「采纳 AI 建议」：应用模型修正后由人工上架（记为人工处理）。 */
export async function adoptSuggestion(id: string): Promise<{ slug: string; name: string }> {
  const cand = await repo.findCandidate(id);
  if (!cand) throw new DomainError("候选不存在或已删除");
  if (cand.status !== "pending") throw new DomainError("这条候选已处理过了");
  const notes = readReviewNotes(cand.reviewNotes);
  if (!notes || cand.reviewVerdict !== "approve") throw new DomainError("这条候选没有「建议上架」的 AI 结论");
  const parsed = candidatePayloadSchema.safeParse(cand.payload);
  if (!parsed.success) throw new DomainError("候选数据格式异常");
  const ctx = await buildCtx(false);
  const { payload, applied } = applyFixes(parsed.data, notes.fixes, { categorySlugs: new Set(ctx.categories.map((c) => c.slug)), tagByName: ctx.tagByName });
  if (applied.length) await repo.updateCandidatePayload(id, payload, payload.name);
  const r = await convertCandidate(id, "publish", reviewInputOf(payload));
  return { slug: r.slug, name: payload.name };
}
