import type { RawCandidate } from "../types";
import { arr, fetchJson, num, obj, str, toDate } from "./http";

/**
 * Hugging Face Spaces：GET https://huggingface.co/api/spaces?sort=likes&direction=-1&limit=…&expand[]=…
 * 用 expand 只取需要的字段（不带 siblings 文件列表）。无需 token。
 */
export const HF_SPACES_API =
  "https://huggingface.co/api/spaces?sort=likes&direction=-1&limit=100&expand[]=cardData&expand[]=likes&expand[]=lastModified&expand[]=sdk&expand[]=tags&expand[]=private";

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

export async function fetchHuggingface(): Promise<RawCandidate[]> {
  return parseHfSpaces(await fetchJson(HF_SPACES_API));
}
