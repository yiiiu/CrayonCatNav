import { GITHUB_API } from "./sources/github";
import { HF_SPACES_BASE } from "./sources/huggingface";
import { arr, fetchJson, num, obj } from "./sources/http";
import type { TermField } from "./term-rules";

/**
 * 扩词命中校验：用真实搜索接口数一下这个词能搜到多少结果。
 * - GitHub 主题：topic:x stars:>=门槛 的 total_count
 * - GitHub 关键词："x" in:name,description,topics stars:>=门槛 的 total_count
 * - HF 搜索词：/api/spaces?search=x&limit=100 的条数（接口最多给 100，≥100 记为「100+」）
 * 结果按「字段 + 词 + 门槛」在内存里缓存 24 小时（单实例足够；多实例各自缓存也无妨）。
 */

export const HIT_CACHE_MS = 24 * 3600_000;
const HF_LIMIT = 100;

export type HitResult = { hits: number; capped: boolean };
type Fetcher = (url: string, headers: Record<string, string>) => Promise<unknown>;

const cache = new Map<string, { at: number; value: HitResult }>();

export function clearHitCache() {
  cache.clear();
}

export function hitQueryUrl(field: TermField, term: string, minStars: number): string {
  if (field === "hfSearch") return `${HF_SPACES_BASE}?search=${encodeURIComponent(term)}&limit=${HF_LIMIT}`;
  const q = field === "githubTopics" ? `topic:${term}` : `"${term.replace(/"/g, "")}" in:name,description,topics`;
  return `${GITHUB_API}/search/repositories?q=${encodeURIComponent(`${q} stars:>=${minStars}`)}&per_page=1`;
}

export function parseHits(field: TermField, json: unknown): HitResult {
  if (field === "hfSearch") {
    const n = arr(json).length;
    return { hits: n, capped: n >= HF_LIMIT };
  }
  const n = num(obj(json).total_count);
  if (n === null) throw new Error("GitHub 返回里没有 total_count");
  return { hits: n, capped: false };
}

const defaultFetcher: Fetcher = (url, headers) => fetchJson(url, { headers, timeoutMs: 8_000 });

/** 查单个词的命中数；失败返回 null（不阻断，界面标「未校验」）。 */
export async function termHits(
  field: TermField,
  term: string,
  opts: { minStars: number; githubToken?: string | null; fetcher?: Fetcher; now?: number },
): Promise<HitResult | null> {
  const now = opts.now ?? Date.now();
  const key = `${field}|${term.toLowerCase()}|${field === "hfSearch" ? 0 : opts.minStars}`;
  const hit = cache.get(key);
  if (hit && now - hit.at < HIT_CACHE_MS) return hit.value;
  const headers: Record<string, string> =
    field === "hfSearch"
      ? {}
      : { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", ...(opts.githubToken ? { authorization: `Bearer ${opts.githubToken}` } : {}) };
  try {
    const value = parseHits(field, await (opts.fetcher ?? defaultFetcher)(hitQueryUrl(field, term, opts.minStars), headers));
    cache.set(key, { at: now, value });
    return value;
  } catch {
    return null;
  }
}

/**
 * 批量校验：GitHub 无 Token 时只查前 MAX 个（其余 null），有 Token 时全查；HF 不限。
 * 顺序执行，避免触发 GitHub 的二级限流。
 */
export async function termHitsBatch(
  field: TermField,
  terms: readonly string[],
  opts: { minStars: number; githubToken?: string | null; maxUnauth: number; fetcher?: Fetcher; now?: number },
): Promise<(HitResult | null)[]> {
  const limit = field === "hfSearch" || opts.githubToken ? terms.length : opts.maxUnauth;
  const out: (HitResult | null)[] = [];
  for (const [i, t] of terms.entries()) out.push(i < limit ? await termHits(field, t, opts) : null);
  return out;
}
