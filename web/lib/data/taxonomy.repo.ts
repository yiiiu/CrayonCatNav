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
/** 已发布资源用到的标签，按使用次数排序；传分类时只统计该分类内的资源。 */
export async function listUsedTags(limit = 60, cat?: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.taxonomy, cacheTags.resources);
  const scope = cat ? { ...publishedOnly, category: { slug: cat } } : publishedOnly;
  const tags = await prisma.tag.findMany({
    where: { resources: { some: { resource: scope } } },
    include: { _count: { select: { resources: { where: { resource: scope } } } } },
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
  create: (data: { name: string; slug: string; aliases?: string[] }) => prisma.tag.create({ data }),
  update: (id: string, data: { name: string; slug: string; aliases?: string[] }) => prisma.tag.update({ where: { id }, data }),
  allForVocab: () => prisma.tag.findMany({ select: { id: true, name: true, aliases: true } }),
  delete: (id: string) => prisma.tag.delete({ where: { id } }),
  findById: (id: string) => prisma.tag.findUnique({ where: { id } }),
  /**
   * 合并标签：来源标签的资源转到目标标签（已有的跳过），待定词改指向目标，
   * 目标别名写入 aliases，最后删除来源标签。返回受影响资源的 slug（刷新缓存用）。
   */
  merge: (sourceId: string, targetId: string, aliases: string[]) =>
    prisma.$transaction(async (tx) => {
      const links = await tx.resourceTag.findMany({ where: { tagId: sourceId }, select: { resourceId: true, resource: { select: { slug: true } } } });
      if (links.length > 0) {
        await tx.resourceTag.createMany({ data: links.map((l) => ({ resourceId: l.resourceId, tagId: targetId })), skipDuplicates: true });
      }
      await tx.tagSuggestion.updateMany({ where: { tagId: sourceId }, data: { tagId: targetId } });
      await tx.tag.delete({ where: { id: sourceId } });
      await tx.tag.update({ where: { id: targetId }, data: { aliases } });
      return links.map((l) => l.resource.slug);
    }),
};
