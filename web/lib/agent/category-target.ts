/**
 * 按分类定向采集的纯函数：来源过滤、自动选分类、目标分类结果修正。不依赖 Next / 数据库，可单测。
 */
import { collectSourceKeys, type CollectConfig, type CollectSourceKey } from "@/lib/validation/collect-config";

/** 全局来源开关（采集 Agent 设置）。productHunt 由调用方折算为「开关开启且已配置 Token」。 */
export type GlobalSources = Record<CollectSourceKey, boolean>;

/** 本次实际要跑的来源：分类配置里开启 且 全局开关也开启。 */
export function activeSources(config: CollectConfig, global: GlobalSources): CollectSourceKey[] {
  return collectSourceKeys.filter((k) => config.sources[k] && global[k]);
}

export type CategoryStat = {
  id: string;
  slug: string;
  name: string;
  sortOrder: number;
  /** 已上架资源数 */
  published: number;
  /** 待审核候选数（按候选的 categorySlug 统计） */
  pending: number;
  /** null = 未配置（或库里的配置不合法） */
  config: CollectConfig | null;
};

/** 能参与采集：已配置、启用、且至少有一个来源在全局也开着。 */
export function isCollectable(stat: Pick<CategoryStat, "config">, global: GlobalSources): boolean {
  return !!stat.config && stat.config.enabled && activeSources(stat.config, global).length > 0;
}

/**
 * 自动模式选目标分类：在可参与采集的分类里取「已上架 + 待审核」最少的；
 * 并列时按 sortOrder，再按 slug 保证结果稳定。没有可选分类返回 null。
 */
export function pickTargetCategory<T extends CategoryStat>(stats: readonly T[], global: GlobalSources): T | null {
  let best: T | null = null;
  for (const s of stats) {
    if (!isCollectable(s, global)) continue;
    if (!best) {
      best = s;
      continue;
    }
    const a = s.published + s.pending;
    const b = best.published + best.pending;
    if (a < b || (a === b && (s.sortOrder < best.sortOrder || (s.sortOrder === best.sortOrder && s.slug < best.slug)))) best = s;
  }
  return best;
}

/** 模型把条目归到非目标分类时，置信度最多这么高。 */
export const OFF_TARGET_MAX_CONFIDENCE = 0.5;
const OFF_TARGET_MARK = "不属于目标分类";

/**
 * 目标分类修正（模型提示里已要求，这里兜底保证）：categorySlug 不是目标分类时，
 * 置信度压到 OFF_TARGET_MAX_CONFIDENCE 以下，reason 开头标明不属于目标分类。
 */
export function applyTargetCategory<R extends { payload: { categorySlug: string }; reason: string; confidence: number }>(
  result: R,
  target: { slug: string; name: string } | null,
): R {
  if (!target || result.payload.categorySlug === target.slug) return result;
  const reason = result.reason.includes(OFF_TARGET_MARK) ? result.reason : `【${OFF_TARGET_MARK}「${target.name}」】${result.reason}`;
  return { ...result, confidence: Math.min(result.confidence, OFF_TARGET_MAX_CONFIDENCE), reason: reason.slice(0, 500) };
}
