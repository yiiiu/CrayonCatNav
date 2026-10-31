import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { AgentApiChannel } from "@/generated/prisma/client";
import type { AgentCatalogRow } from "@/lib/agent-api/core";
import { cacheTags } from "@/lib/cache/tags";
import { prisma } from "./prisma";
import { publishedOnly } from "./resource.repo";

/** Agent 接入目录：全部已发布资源的列表字段（几百条以内，筛选在内存里做）。 */
export async function listAgentCatalog(): Promise<AgentCatalogRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  return prisma.resource.findMany({
    where: publishedOnly,
    select: {
      slug: true,
      name: true,
      summary: true,
      websiteUrl: true,
      githubUrl: true,
      pricingType: true,
      featuredOrder: true,
      category: { select: { slug: true, name: true } },
      tags: { select: { tag: { select: { slug: true, name: true, aliases: true } } }, orderBy: { tag: { name: "asc" } } },
    },
    orderBy: { updatedAt: "desc" },
  }).then((rows) => rows.map((r) => ({ ...r, tags: r.tags.map((t) => t.tag) })));
}

/** 单个已发布资源的详情字段。 */
export async function findAgentResource(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources, cacheTags.resource(slug));
  return prisma.resource.findFirst({
    where: { ...publishedOnly, slug },
    select: {
      slug: true,
      name: true,
      summary: true,
      description: true,
      websiteUrl: true,
      githubUrl: true,
      pricingType: true,
      details: true,
      updatedAt: true,
      category: { select: { slug: true, name: true } },
      tags: { select: { tag: { select: { slug: true, name: true } } }, orderBy: { tag: { name: "asc" } } },
      tools: { select: { tool: { select: { slug: true } } } },
    },
  });
}

/** 累加一次调用（按自然日 × 通道 × 工具）。 */
export async function addAgentApiCall(day: Date, channel: AgentApiChannel, tool: string) {
  await prisma.agentApiDaily.upsert({
    where: { day_channel_tool: { day, channel, tool } },
    create: { day, channel, tool, calls: 1 },
    update: { calls: { increment: 1 } },
  });
}

/** [start, end) 区间内按通道 × 工具汇总。 */
export async function sumAgentApiCalls(start: Date, end: Date) {
  const rows = await prisma.agentApiDaily.groupBy({
    by: ["channel", "tool"],
    where: { day: { gte: start, lt: end } },
    _sum: { calls: true },
  });
  return rows.map((r) => ({ channel: r.channel, tool: r.tool, calls: r._sum.calls ?? 0 }));
}
