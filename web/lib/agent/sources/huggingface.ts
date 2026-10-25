import type { RawCandidate } from "../types";
import { arr, fetchJson, num, obj, str, toDate } from "./http";

/**
 * Hugging Face Spaces：GET https://huggingface.co/api/spaces?sort=likes&direction=-1&limit=…&expand[]=…
 * 用 expand 只取需要的字段（不带 siblings 文件列表）。无需 token。
 * 2026-10-26 实测：search=词 按 Space id（owner/name）做子串匹配，如 search=image 返回 Z-Image-Turbo 等；
 * filter=标签 按 Space 标签过滤（如 filter=text-to-image），但多数 Space 不打任务标签、结果偏少，所以分类配置只用 search。
 */
export const HF_SPACES_BASE = "https://huggingface.co/api/spaces";
const HF_EXPAND = "expand[]=cardData&expand[]=likes&expand[]=lastModified&expand[]=sdk&expand[]=tags&expand[]=private";

/** 无搜索词：全站点赞最高的 100 个；有搜索词：该词点赞最高的 30 个。 */
export function hfSpacesUrl(search?: string): string {
  if (!search) return `${HF_SPACES_BASE}?sort=likes&direction=-1&limit=100&${HF_EXPAND}`;
  return `${HF_SPACES_BASE}?search=${encodeURIComponent(search)}&sort=likes&direction=-1&limit=30&${HF_EXPAND}`;
}

export function parseHfSpaces(json: unknown): RawCandidate[] {
  const out: RawCandidate[] = [];
  for (const item of arr(json)) {
    const s = obj(item);
    const id = str(s.id);
    if (!/^[\w.-]+\/[\w.-]+$/.test(id) || id.split("/").some((p) => /^\.+$/.test(p)) || s.private === true) continue;
    const card = obj(s.cardData);
    const url = `https://huggingface.co/spaces/${id}`;
    const tags = arr(s.tags).map(str).filter((t) => t && !t.startsWith("region:"));
    const sdk = str(s.sdk) || str(card.sdk);
    out.push({
      source: "huggingface",
      sourceUrl: url,
      title: str(card.title) || id.split("/")[1],
      websiteUrl: url,
      githubUrl: null,
      description: str(card.short_description).slice(0, 600),
      stars: num(s.likes),
      sourceUpdatedAt: toDate(s.lastModified),
      hints: [`Space：${id}`, ...(sdk ? [`SDK：${sdk}`] : []), ...(tags.length ? [`标签：${tags.slice(0, 8).join(", ")}`] : [])],
    });
  }
  return out;
}

/** 按分类的搜索词逐个查询并交错合并（同一 Space 只保留一次）；没有搜索词时取全站热门。 */
export async function fetchHuggingface(searches: readonly string[] = []): Promise<RawCandidate[]> {
  if (searches.length === 0) return parseHfSpaces(await fetchJson(hfSpacesUrl()));
  const lists: RawCandidate[][] = [];
  const errors: string[] = [];
  for (const q of searches) {
    try {
      lists.push(parseHfSpaces(await fetchJson(hfSpacesUrl(q))));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "未知错误");
    }
  }
  if (lists.length === 0) throw new Error(`Hugging Face 搜索全部失败：${errors[0] ?? ""}`);
  const seen = new Set<string>();
  const merged: RawCandidate[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) {
    for (const l of lists) {
      const item = l[i];
      if (item && !seen.has(item.sourceUrl)) {
        seen.add(item.sourceUrl);
        merged.push(item);
      }
    }
  }
  return merged;
}
