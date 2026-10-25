import type { RawCandidate } from "./types";
import { urlKeysOf } from "./url";

/** 一个原始条目的去重键（官网 + GitHub 仓库）。 */
export const rawKeys = (r: Pick<RawCandidate, "websiteUrl" | "githubUrl">) => urlKeysOf(r.githubUrl, r.websiteUrl);

/** 是否与已知键（现有资源 + 全部候选，含已拒绝）重复。 */
export function isKnown(keys: string[], known: ReadonlySet<string>) {
  return keys.length === 0 || keys.some((k) => known.has(k));
}

/**
 * 把多个来源的结果轮流交错成一个队列，同时去掉与已知键重复、以及批内互相重复的条目。
 * 返回待处理队列与重复数；队列按来源轮转，避免一个来源占满名额。
 */
export function buildQueue(pools: RawCandidate[][], known: ReadonlySet<string>) {
  const seen = new Set(known);
  const queue: RawCandidate[] = [];
  let duplicates = 0;
  const maxLen = Math.max(0, ...pools.map((p) => p.length));
  for (let i = 0; i < maxLen; i++) {
    for (const pool of pools) {
      const item = pool[i];
      if (!item) continue;
      const keys = rawKeys(item);
      if (isKnown(keys, seen)) {
        duplicates++;
        continue;
      }
      for (const k of keys) seen.add(k);
      queue.push(item);
    }
  }
  return { queue, duplicates };
}
