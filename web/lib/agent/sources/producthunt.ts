import type { RawCandidate } from "../types";
import { arr, daysAgoIso, fetchJson, num, obj, str, toDate } from "./http";

/**
 * Product Hunt GraphQL v2：POST https://api.producthunt.com/v2/api/graphql，需要 Bearer token
 * （开发者后台 Developer Token）。未配置 token 时整个来源跳过。
 * website 字段是 Product Hunt 的跳转链接，真实官网在链接检查时取最终落地地址。
 */
export const PH_API = "https://api.producthunt.com/v2/api/graphql";

export const PH_QUERY = `query AiPosts($after: DateTime!) {
  posts(first: 30, order: VOTES, topic: "artificial-intelligence", postedAfter: $after) {
    edges { node { id name tagline description url website votesCount createdAt topics(first: 5) { edges { node { name } } } } }
  }
}`;

export function parseProductHunt(json: unknown): RawCandidate[] {
  const root = obj(json);
  if (arr(root.errors).length && !root.data) {
    const first = obj(arr(root.errors)[0]);
    throw new Error(`Product Hunt 返回错误：${str(first.error) || str(first.message) || "未知"}`);
  }
  const out: RawCandidate[] = [];
  for (const edge of arr(obj(obj(obj(root.data).posts)).edges)) {
    const n = obj(obj(edge).node);
    const name = str(n.name);
    const pageUrl = str(n.url);
    if (!name || !pageUrl.startsWith("https://")) continue;
    const website = str(n.website);
    const topics = arr(obj(n.topics).edges)
      .map((e) => str(obj(obj(e).node).name))
      .filter(Boolean);
    out.push({
      source: "producthunt",
      sourceUrl: pageUrl.split("?")[0],
      title: name,
      websiteUrl: website.startsWith("https://") ? website : null,
      githubUrl: null,
      description: [str(n.tagline), str(n.description)].filter(Boolean).join(" — ").slice(0, 800),
      stars: num(n.votesCount),
      sourceUpdatedAt: toDate(n.createdAt),
      hints: topics.length ? [`话题：${topics.join(", ")}`] : [],
    });
  }
  return out;
}

export async function fetchProductHunt(token: string, now = new Date()): Promise<RawCandidate[]> {
  const json = await fetchJson(PH_API, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ query: PH_QUERY, variables: { after: daysAgoIso(7, now) } }),
  });
  return parseProductHunt(json);
}
