import "server-only";
import { checkBudget, emptyUsage, monthRange, type BudgetSettings, type ModelPurpose, type Usage } from "@/lib/agent/budget";
import { chat, type ChatConfig, type ChatMessage, type ChatResult } from "@/lib/agent/llm";
import { statDay } from "@/lib/analytics/traffic";
import * as repo from "@/lib/data/agent.repo";
import { addModelUsage, sumModelUsage } from "@/lib/data/model-usage.repo";
import { DomainError } from "./result";

/** 每月模型花费上限：用量统计 + 调用前检查（规格 docs/spec/前台推荐Agent方案.md §5.2）。 */

type Setting = Awaited<ReturnType<typeof repo.getSetting>>;

export function budgetSettingsOf(s: Pick<Setting, "priceInputPerM" | "priceOutputPerM" | "monthlyBudget" | "recommendShare">): BudgetSettings {
  return { prices: { input: s.priceInputPerM, output: s.priceOutputPerM }, monthlyBudget: s.monthlyBudget, recommendShare: s.recommendShare };
}

/** 本月（北京时间）各用途用量。 */
export async function monthUsage(now = new Date()): Promise<Record<ModelPurpose, Usage>> {
  const { start, end } = monthRange(statDay(now));
  const out: Record<ModelPurpose, Usage> = { recommend: emptyUsage(), collect: emptyUsage(), enrich: emptyUsage(), term: emptyUsage() };
  for (const r of await sumModelUsage(start, end)) out[r.purpose] = { calls: r.calls, promptTokens: r.promptTokens, completionTokens: r.completionTokens };
  return out;
}

/** 后台任务（采集 / 补全 / 扩词）调用前检查，超限抛 DomainError。 */
export async function assertBudget(purpose: Exclude<ModelPurpose, "recommend">, setting?: Setting) {
  const s = setting ?? (await repo.getSetting());
  const r = checkBudget(purpose, await monthUsage(), budgetSettingsOf(s));
  if (!r.ok) throw new DomainError("本月模型花费已达上限，可在「采集 Agent」页调高上限后再试");
}

/** 调模型并记用量；记账失败不影响结果。 */
export async function trackedChat(
  purpose: ModelPurpose,
  cfg: ChatConfig,
  messages: ChatMessage[],
  opts: Parameters<typeof chat>[2] = {},
): Promise<ChatResult> {
  const r = await chat(cfg, messages, opts);
  await addModelUsage(statDay(), purpose, r.usage?.promptTokens ?? 0, r.usage?.completionTokens ?? 0).catch(() => {});
  return r;
}
