import "server-only";
import type { AgentApiChannel } from "@/generated/prisma/client";
import {
  describeIssues,
  resourceInput,
  searchCatalog,
  searchInput,
  TAG_LIST_MAX,
  tagsInput,
  toListItem,
  type AgentListItem,
  type Pricing,
} from "@/lib/agent-api/core";
import { statDay } from "@/lib/analytics/traffic";
import { addAgentApiCall, findAgentResource, listAgentCatalog } from "@/lib/data/agent-api.repo";
import { listCategoriesWithCounts } from "@/lib/data/taxonomy.repo";
import { AGENT_GLOBAL_DAY, AGENT_IP_DAY, AGENT_IP_MIN, GLOBAL_SUBJECT, hitAll } from "@/lib/security/rate-limit";
import { siteConfig } from "@/lib/site";
import { isToolSlug } from "@/lib/tools/metas";
import { deriveToolPrefill } from "@/lib/tools/prefill";
import { getTool } from "@/lib/tools/registry";
import { readDetails } from "@/lib/validation/resource-details";

/**
 * Agent 接入核心服务（规格 docs/spec/Agent接入方案.md）：只读、只返回已发布资源，不调模型。
 * HTTP API 与 MCP 都走这里；调用方负责先过 guard() 限流。
 */

export type AgentTool = "list_categories" | "list_tags" | "search_resources" | "get_resource";

export type AgentResult<T> = { ok: true; data: T } | { ok: false; code: "invalid_input" | "not_found"; message: string };

const DESCRIPTION_MAX = 2000;
const origin = () => siteConfig.url.replace(/\/$/, "");

/** 匿名限流：每个 IP 每分钟 / 每天 + 全站每天。 */
export async function guard(ip: string): Promise<{ ok: true } | { ok: false; retryAfterSec: number }> {
  const r = await hitAll([
    [AGENT_IP_MIN, ip],
    [AGENT_IP_DAY, ip],
    [AGENT_GLOBAL_DAY, GLOBAL_SUBJECT],
  ]);
  return r.ok ? { ok: true } : { ok: false, retryAfterSec: r.retryAfterSec };
}

/** 记一次调用；失败不影响响应。只记通道与工具名，不记参数。 */
export function track(channel: AgentApiChannel, tool: AgentTool): void {
  void addAgentApiCall(statDay(), channel, tool).catch(() => {});
}

export async function listCategories(): Promise<AgentResult<{ categories: { slug: string; name: string; count: number }[] }>> {
  const rows = await listCategoriesWithCounts();
  return {
    ok: true,
    data: { categories: rows.filter((c) => c._count.resources > 0).map((c) => ({ slug: c.slug, name: c.name, count: c._count.resources })) },
  };
}

export async function listTags(raw: unknown): Promise<AgentResult<{ category: string | null; tags: { slug: string; name: string; count: number }[] }>> {
  const p = tagsInput.safeParse(raw ?? {});
  if (!p.success) return { ok: false, code: "invalid_input", message: describeIssues(p.error) };
  const rows = (await listAgentCatalog()).filter((r) => !p.data.category || r.category.slug === p.data.category);
  const counts = new Map<string, { slug: string; name: string; count: number }>();
  for (const r of rows)
    for (const t of r.tags) {
      const c = counts.get(t.slug) ?? { slug: t.slug, name: t.name, count: 0 };
      c.count++;
      counts.set(t.slug, c);
    }
  const tags = [...counts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "zh")).slice(0, TAG_LIST_MAX);
  return { ok: true, data: { category: p.data.category ?? null, tags } };
}

export async function searchResources(raw: unknown): Promise<AgentResult<{ total: number; nextCursor: string | null; items: AgentListItem[] }>> {
  const p = searchInput.safeParse(raw ?? {});
  if (!p.success) return { ok: false, code: "invalid_input", message: describeIssues(p.error) };
  const r = searchCatalog(await listAgentCatalog(), p.data);
  const o = origin();
  return { ok: true, data: { total: r.total, nextCursor: r.nextCursor, items: r.items.map((x) => toListItem(x, o)) } };
}

export type AgentResourceDetail = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: { slug: string; name: string };
  tags: { slug: string; name: string }[];
  pricing: Pricing | null;
  pricingNote: string | null;
  websiteUrl: string | null;
  githubUrl: string | null;
  url: string;
  highlights: string[];
  useCases: string[];
  platforms: string[];
  /** 快速上手：安装命令或配置片段，没有就是 null（不编造） */
  quickstart: string | null;
  /** 站内可直接用的配套工具，如 MCP 配置生成器（已按资源预填） */
  siteTools: { name: string; url: string }[];
  updatedAt: string;
};

export async function getResource(raw: unknown): Promise<AgentResult<AgentResourceDetail>> {
  const p = resourceInput.safeParse(raw ?? {});
  if (!p.success) return { ok: false, code: "invalid_input", message: describeIssues(p.error) };
  const r = await findAgentResource(p.data.slug);
  if (!r) return { ok: false, code: "not_found", message: `没有找到资源 ${p.data.slug}（可用 search_resources 查找）` };
  const d = readDetails(r.details);
  const o = origin();
  const siteTools = r.tools.flatMap(({ tool: { slug } }) => {
    const t = getTool(slug);
    if (!t || t.defaultStatus === "hidden") return [];
    let url = `${o}/tools/${t.slug}`;
    if (isToolSlug(t.slug)) {
      const qs = deriveToolPrefill(t.slug, { slug: r.slug, name: r.name, summary: r.summary, categorySlug: r.category.slug }).toString();
      if (qs) url += `?${qs}`;
    }
    return [{ name: t.name, url }];
  });
  const desc = r.description.trim();
  return {
    ok: true,
    data: {
      slug: r.slug,
      name: r.name,
      summary: r.summary,
      description: desc.length > DESCRIPTION_MAX ? `${desc.slice(0, DESCRIPTION_MAX)}…` : desc,
      category: r.category,
      tags: r.tags.map((t) => t.tag),
      pricing: r.pricingType === "unknown" ? null : r.pricingType,
      pricingNote: d.pricingNote || null,
      websiteUrl: r.websiteUrl,
      githubUrl: r.githubUrl,
      url: `${o}/resources/${r.slug}`,
      highlights: d.highlights,
      useCases: d.useCases,
      platforms: d.platforms,
      quickstart: d.quickstart || null,
      siteTools,
      updatedAt: r.updatedAt.toISOString(),
    },
  };
}
