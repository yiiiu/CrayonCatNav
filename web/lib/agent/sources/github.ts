import type { RawCandidate } from "../types";
import { canonicalGithubUrl } from "../url";
import { arr, daysAgoIso, fetchJson, httpsOrNull, num, obj, str, toDate } from "./http";

/**
 * GitHub Search API：GET https://api.github.com/search/repositories?q=...&sort=stars&order=desc
 * 无 token 时搜索接口限 10 次/分钟，配置 token 后 30 次/分钟。
 */
export const GITHUB_API = "https://api.github.com";

/** 采集的主题；每个主题查「近期活跃的热门」与「近半年新起的」两组。 */
export const GITHUB_TOPICS = ["mcp-server", "ai-agents", "agent-skills"] as const;

export function githubQueries(now = new Date()): string[] {
  const pushed = daysAgoIso(30, now).slice(0, 10);
  const created = daysAgoIso(120, now).slice(0, 10);
  return GITHUB_TOPICS.flatMap((t) => [`topic:${t} stars:>=500 pushed:>=${pushed} archived:false fork:false`, `topic:${t} stars:>=100 created:>=${created} archived:false fork:false`]);
}

/** 解析单个仓库对象（search items 与 /repos/{owner}/{repo} 结构相同）。 */
export function parseGithubRepo(item: unknown, source: RawCandidate["source"] = "github"): RawCandidate | null {
  const r = obj(item);
  if (r.archived === true || r.fork === true || r.private === true || r.disabled === true) return null;
  const githubUrl = canonicalGithubUrl(str(r.html_url));
  if (!githubUrl) return null;
  const homepage = httpsOrNull(r.homepage);
  const websiteUrl = homepage && !/^https:\/\/(www\.)?github\.com\//i.test(homepage) ? homepage : null;
  const topics = arr(r.topics).map(str).filter(Boolean).slice(0, 12);
  const lang = str(r.language);
  const license = str(obj(r.license).spdx_id);
  return {
    source,
    sourceUrl: githubUrl,
    title: str(r.name) || str(r.full_name),
    websiteUrl,
    githubUrl,
    description: str(r.description).slice(0, 1000),
    stars: num(r.stargazers_count),
    sourceUpdatedAt: toDate(r.pushed_at) ?? toDate(r.updated_at),
    hints: [
      `仓库：${str(r.full_name)}`,
      ...(lang ? [`主要语言：${lang}`] : []),
      ...(license && license !== "NOASSERTION" ? [`许可证：${license}`] : []),
      ...(topics.length ? [`topics：${topics.join(", ")}`] : []),
    ],
  };
}

export function parseGithubSearch(json: unknown): RawCandidate[] {
  return arr(obj(json).items)
    .map((i) => parseGithubRepo(i))
    .filter((x): x is RawCandidate => x !== null);
}

function ghHeaders(token?: string | null): Record<string, string> {
  return {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28",
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchGithub(token?: string | null, now = new Date()): Promise<RawCandidate[]> {
  const lists: RawCandidate[][] = [];
  const errors: string[] = [];
  for (const q of githubQueries(now)) {
    try {
      const json = await fetchJson(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=30`, { headers: ghHeaders(token) });
      lists.push(parseGithubSearch(json));
    } catch (e) {
      errors.push(e instanceof Error ? e.message : "未知错误");
    }
  }
  if (lists.length === 0) throw new Error(`GitHub 搜索全部失败：${errors[0] ?? ""}`);
  // 各查询结果交错合并，避免一个主题占满
  const merged: RawCandidate[] = [];
  for (let i = 0; lists.some((l) => i < l.length); i++) for (const l of lists) if (l[i]) merged.push(l[i]);
  return merged;
}

/** 管理员贴的 GitHub 仓库链接：直接读仓库 API，信息比抓网页准确。 */
export async function fetchGithubRepo(ownerRepo: string, token?: string | null): Promise<RawCandidate | null> {
  const json = await fetchJson(`${GITHUB_API}/repos/${ownerRepo}`, { headers: ghHeaders(token) });
  return parseGithubRepo(json, "manual");
}
