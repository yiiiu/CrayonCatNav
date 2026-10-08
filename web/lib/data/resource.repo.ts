import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { cacheTags } from "@/lib/cache/tags";
import { prisma } from "./prisma";

/** 所有公共查询必须经过此条件，从仓储层杜绝草稿泄漏。 */
export const publishedOnly = { status: "published" } as const satisfies Prisma.ResourceWhereInput;

export async function findPublishedBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources, cacheTags.resource(slug));
  return prisma.resource.findFirst({
    where: { ...publishedOnly, slug },
    include: { category: true, tags: { include: { tag: true } }, tools: { include: { tool: true } } },
  });
}

export async function listFeatured(limit = 8) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources, cacheTags.home);
  return prisma.resource.findMany({
    where: { ...publishedOnly, featuredOrder: { not: null } },
    orderBy: { featuredOrder: "asc" },
    take: limit,
    include: { category: true },
  });
}

export async function listPublishedSlugs() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  return prisma.resource.findMany({ where: publishedOnly, select: { slug: true, updatedAt: true } });
}
