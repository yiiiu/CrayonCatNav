import type { RawCandidate } from "../types";
import { arr, daysAgoIso, fetchJson, httpsOrNull, obj, str, toDate } from "./http";

/**
 * MCP 官方 Registry：GET https://registry.modelcontextprotocol.io/v0.1/servers
 * 参数：version=latest、updated_since（RFC3339）、limit（≤100）、cursor。无需 token。
 * 条目形如 { server: { name, title?, description, websiteUrl?, repository?: { url, source } }, _meta: { "io.modelcontextprotocol.registry/official": { status, updatedAt, isLatest } } }
 */
export const MCP_REGISTRY_API = "https://registry.modelcontextprotocol.io/v0.1/servers";
const META_KEY = "io.modelcontextprotocol.registry/official";

export function parseMcpRegistry(json: unknown): RawCandidate[] {
  const out: RawCandidate[] = [];
  for (const item of arr(obj(json).servers)) {
    const server = obj(obj(item).server);
    const meta = obj(obj(obj(item)._meta)[META_KEY]);
    const status = str(meta.status);
    if (status && status !== "active") continue; // 跳过 deleted / deprecated
    if (meta.isLatest === false) continue;
    const name = str(server.name);
    if (!name) continue;
    const repo = obj(server.repository);
    const repoUrl = httpsOrNull(repo.url);
    const githubUrl = repoUrl && /^https:\/\/github\.com\//i.test(repoUrl) ? repoUrl : null;
    const websiteUrl = httpsOrNull(server.websiteUrl);
    if (!githubUrl && !websiteUrl) continue; // 只有远程端点、没有可介绍的主页，不收
    out.push({
      source: "mcp_registry",
      sourceUrl: `${MCP_REGISTRY_API}/${encodeURIComponent(name)}/versions/latest`,
      title: str(server.title) || name,
      websiteUrl,
      githubUrl,
      description: str(server.description).slice(0, 1000),
      stars: null,
      sourceUpdatedAt: toDate(meta.updatedAt),
      hints: [`registry 名称：${name}`],
    });
  }
  // 有 GitHub 仓库的优先（信息更可核实）
  return out.sort((a, b) => Number(!!b.githubUrl) - Number(!!a.githubUrl));
}

export async function fetchMcpRegistry(now = new Date()): Promise<RawCandidate[]> {
  const url = `${MCP_REGISTRY_API}?version=latest&limit=100&updated_since=${encodeURIComponent(daysAgoIso(14, now))}`;
  return parseMcpRegistry(await fetchJson(url));
}
