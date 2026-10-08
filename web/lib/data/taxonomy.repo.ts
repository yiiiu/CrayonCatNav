import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { cacheTags } from "@/lib/cache/tags";
import { prisma } from "./prisma";
import { publishedOnly } from "./resource.repo";

/* ---------- 公共读取 ---------- */

export async function listCategoriesWithCounts() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy, cacheTags.resources);
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { resources: { where: publishedOnly } } } },
  });
}

/** 仅返回至少挂了一个已发布资源的标签，按使用量排序。 */
export async function listUsedTags(limit = 24) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy, cacheTags.resources);
  const tags = await prisma.tag.findMany({
    where: { resources: { some: { resource: publishedOnly } } },
    include: { _count: { select: { resources: { where: { resource: publishedOnly } } } } },
  });
  return tags.toSorted((a, b) => b._count.resources - a._count.resources || a.name.localeCompare(b.name, "zh")).slice(0, limit);
}

/* ---------- 后台 ---------- */

export function adminListCategories() {
  return prisma.category.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { resources: true } } } });
}

export function adminListTags() {
  return prisma.tag.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { resources: true } } } });
}

export function adminListTools() {
  return prisma.tool.findMany({ orderBy: { sortOrder: "asc" } });
}

export const categoryRepo = {
  findBySlug: (slug: string) => prisma.category.findUnique({ where: { slug } }),
  create: (data: { name: string; slug: string; sortOrder: number }) => prisma.category.create({ data }),
  update: (id: string, data: { name: string; slug: string; sortOrder: number }) =>
    prisma.category.update({ where: { id }, data }),
  countResources: (id: string) => prisma.resource.count({ where: { categoryId: id } }),
  delete: (id: string) => prisma.category.delete({ where: { id } }),
};

export const tagRepo = {
  findBySlug: (slug: string) => prisma.tag.findUnique({ where: { slug } }),
  create: (data: { name: string; slug: string }) => prisma.tag.create({ data }),
  update: (id: string, data: { name: string; slug: string }) => prisma.tag.update({ where: { id }, data }),
  delete: (id: string) => prisma.tag.delete({ where: { id } }),
};
