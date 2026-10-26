import "server-only";
import { buildEnrichPrompt, ENRICH_SYSTEM_PROMPT, mergeDetails, type DetailField } from "@/lib/agent/enrich";
import { chat, LlmError, type ChatConfig, type ChatMessage } from "@/lib/agent/llm";
import { fetchEnrichMaterial } from "@/lib/agent/safe-fetch";
import { extractJson } from "@/lib/validation/candidate";
import { pricingTypes } from "@/lib/validation/resource";
import { cleanModelDetails, hasDetails, readDetails, type ResourceDetails } from "@/lib/validation/resource-details";
import * as repo from "@/lib/data/resource.repo";
import { loadRuntimeConfig } from "./agent-settings.service";
import { DomainError } from "./result";

/** AI 补全资源详情：只填空字段，填了内容即标记「AI 待核对」。计划见 docs/plan/AI批量补全-实现计划.md。 */

export const BATCH_SIZE = 10;
const CONCURRENCY = 3;
const LLM_TIMEOUT_MS = 45_000;

type Row = NonNullable<Awaited<ReturnType<typeof repo.findForEnrich>>>;

const needsEnrich = (r: Pick<Row, "details" | "previewImageUrl">) => !hasDetails(readDetails(r.details)) || !r.previewImageUrl;

type Pricing = (typeof pricingTypes)[number];

async function askModel(cfg: ChatConfig, prompt: string): Promise<{ details: ResourceDetails; pricingType: Pricing }> {
  const messages: ChatMessage[] = [
    { role: "system", content: ENRICH_SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await chat(cfg, messages, { json: true, maxTokens: 1200, timeoutMs: LLM_TIMEOUT_MS });
    try {
      const json = extractJson(r.content);
      if (json && typeof json === "object") {
        const o = json as Record<string, unknown>;
        const pt = (pricingTypes as readonly unknown[]).includes(o.pricingType) ? (o.pricingType as Pricing) : "unknown";
        return { details: cleanModelDetails(o), pricingType: pt };
      }
    } catch {
      /* 重试一次 */
    }
    messages.push({ role: "assistant", content: r.content.slice(0, 3000) }, { role: "user", content: "上次输出不是合法 JSON，请只输出一个 JSON 对象。" });
  }
  throw new LlmError("模型两次都没有输出合法 JSON");
}

export type EnrichOutcome = { slug: string; name: string; filled: DetailField[]; note?: string };

async function enrichRow(cfg: ChatConfig, r: Row): Promise<EnrichOutcome> {
  const current = readDetails(r.details);
  const material = await fetchEnrichMaterial(r.websiteUrl, r.githubUrl);
  let generated = cleanModelDetails({});
  let pricingType: Pricing = "unknown";
  // 主要字段都有了只需补预览图，不调模型；快速上手常常本来就没有，不作为调模型的理由
  const missing = !current.highlights.length || !current.useCases.length || !current.platforms.length || !current.pricingNote || r.pricingType === "unknown";
  if (missing) {
    if (!material.site && !material.readme && !r.description) {
      await repo.saveEnrichment(r.id, { filled: false });
      return { slug: r.slug, name: r.name, filled: [], note: "官网与 README 都抓不到" };
    }
    ({ details: generated, pricingType } = await askModel(cfg, buildEnrichPrompt(r, material)));
  }
  const merged = mergeDetails(current, generated, r.previewImageUrl, material.previewImageUrl);
  // 定价类型同样只在「未知」时填
  const fillPricing = r.pricingType === "unknown" && pricingType !== "unknown";
  if (fillPricing) merged.filled.push("pricingType");
  await repo.saveEnrichment(r.id, {
    details: merged.details,
    previewImageUrl: merged.previewImageUrl,
    ...(fillPricing ? { pricingType } : {}),
    filled: merged.filled.length > 0,
  });
  return { slug: r.slug, name: r.name, filled: merged.filled, note: merged.filled.length ? undefined : "资料不足，没有可补的内容" };
}

export async function enrichOne(id: string): Promise<EnrichOutcome> {
  const cfg = await loadRuntimeConfig();
  const r = await repo.findForEnrich(id);
  if (!r) throw new DomainError("资源不存在或已删除");
  try {
    return await enrichRow(cfg.chat, r);
  } catch (e) {
    if (e instanceof LlmError) throw new DomainError(e.message);
    throw e;
  }
}

export async function countEnrichPending(): Promise<{ pending: number; review: number }> {
  const [rows, review] = await Promise.all([repo.listEnrichCandidates(), repo.countAiReview()]);
  return { pending: rows.filter(needsEnrich).length, review };
}

export type BatchResult = { filled: number; empty: number; failed: number; remaining: number; slugs: string[]; notes: string[] };

export async function enrichBatch(limit = BATCH_SIZE): Promise<BatchResult> {
  const cfg = await loadRuntimeConfig();
  const pending = (await repo.listEnrichCandidates()).filter(needsEnrich);
  const queue = pending.slice(0, limit);
  const res: BatchResult = { filled: 0, empty: 0, failed: 0, remaining: pending.length - queue.length, slugs: [], notes: [] };
  let i = 0;
  const worker = async () => {
    while (i < queue.length) {
      const r = queue[i++];
      try {
        const o = await enrichRow(cfg.chat, r);
        if (o.filled.length) {
          res.filled++;
          res.slugs.push(o.slug);
        } else {
          res.empty++;
          if (o.note) res.notes.push(`${o.name}：${o.note}`);
        }
      } catch (e) {
        // 失败不记录尝试，下次批量还会重试
        res.failed++;
        res.notes.push(`${r.name}：${e instanceof Error ? e.message.slice(0, 80) : "未知错误"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return res;
}
