import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/** 所有公共查询必须经过此条件，从仓储层杜绝草稿泄漏。 */
export const publishedOnly = { status: "published" } as const satisfies Prisma.ResourceWhereInput;

export function findPublishedBySlug(slug: string) {
  return prisma.resource.findFirst({
    where: { ...publishedOnly, slug },
    include: { category: true, tags: { include: { tag: true } }, tools: { include: { tool: true } } },
  });
}

export function listFeatured(limit = 8) {
  return prisma.resource.findMany({
    where: { ...publishedOnly, featuredOrder: { not: null } },
    orderBy: { featuredOrder: "asc" },
    take: limit,
    include: { category: true },
  });
}

export function listPublishedSlugs() {
  return prisma.resource.findMany({ where: publishedOnly, select: { slug: true, updatedAt: true } });
}
