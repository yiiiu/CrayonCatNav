import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma, ResourceStatus } from "@/generated/prisma/client";
import { cacheTags } from "@/lib/cache/tags";
import type { ResourceDetails } from "@/lib/validation/resource-details";
import { prisma } from "./prisma";

/** 所有公共查询必须经过此条件，从仓储层杜绝草稿泄漏。 */
export const publishedOnly = { status: "published" } as const satisfies Prisma.ResourceWhereInput;

export const PAGE_SIZE = 20;

const cardInclude = {
  category: true,
  tags: { include: { tag: true }, orderBy: { tag: { name: "asc" } } },
} satisfies Prisma.ResourceInclude;

export type ResourceCardData = Prisma.ResourceGetPayload<{ include: typeof cardInclude }>;

/* ---------- 公共读取（带缓存） ---------- */

export type PublicSearch = { q?: string; cat?: string; tag?: string; page: number };

function publicWhere({ q, cat, tag }: Omit<PublicSearch, "page">): Prisma.ResourceWhereInput {
  const and: Prisma.ResourceWhereInput[] = [publishedOnly];
  if (cat) and.push({ category: { slug: cat } });
  if (tag) and.push({ tags: { some: { tag: { slug: tag } } } });
  if (q) {
    and.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { summary: { contains: q, mode: "insensitive" } },
        { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
      ],
    });
  }
  return { AND: and };
}

export async function searchPublished(params: PublicSearch) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  const where = publicWhere(params);
  const [total, items] = await Promise.all([
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where,
      include: cardInclude,
      orderBy: [{ featuredOrder: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      skip: (params.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, items, pageSize: PAGE_SIZE };
}

/** 搜索框实时联想：只取前几条的轻量字段，排序与列表页一致。 */
export async function suggestPublished(q: string, limit = 6) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  const where = publicWhere({ q });
  const [total, items] = await Promise.all([
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where,
      select: { slug: true, name: true, summary: true, category: { select: { name: true } } },
      orderBy: [{ featuredOrder: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
      take: limit,
    }),
  ]);
  return { total, items: items.map((r) => ({ slug: r.slug, name: r.name, summary: r.summary, category: r.category.name })) };
}

export async function findPublishedBySlug(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources, cacheTags.resource(slug));
  return prisma.resource.findFirst({
    where: { ...publishedOnly, slug },
    include: { ...cardInclude, tools: { include: { tool: true } } },
  });
}

export async function listRelatedPublished(categoryId: string, excludeId: string, limit = 3) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  return prisma.resource.findMany({
    where: { ...publishedOnly, categoryId, id: { not: excludeId } },
    include: { category: true },
    orderBy: [{ featuredOrder: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take: limit,
  });
}

export async function listFeatured(limit = 6) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources, cacheTags.home);
  return prisma.resource.findMany({
    where: { ...publishedOnly, featuredOrder: { not: null } },
    orderBy: { featuredOrder: "asc" },
    take: limit,
    include: cardInclude,
  });
}

export async function countPublished() {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  return prisma.resource.count({ where: publishedOnly });
}

export async function listPublishedSlugs(limit?: number) {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.resources);
  return prisma.resource.findMany({
    where: publishedOnly,
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

/* ---------- 后台读写（不缓存） ---------- */

export type AdminSearch = { q?: string; cat?: string; status?: ResourceStatus; page: number; aiReview?: boolean };

export async function adminSearch({ q, cat, status, page, aiReview }: AdminSearch) {
  const where: Prisma.ResourceWhereInput = {
    ...(aiReview ? { aiReview: true } : {}),
    ...(status ? { status } : {}),
    ...(cat ? { category: { slug: cat } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { slug: { contains: q, mode: "insensitive" } },
            { tags: { some: { tag: { name: { contains: q, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };
  const [total, items] = await Promise.all([
    prisma.resource.count({ where }),
    prisma.resource.findMany({
      where,
      include: cardInclude,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  return { total, items, pageSize: PAGE_SIZE };
}

export function findById(id: string) {
  return prisma.resource.findUnique({
    where: { id },
    include: { tags: true, tools: true },
  });
}

export function findBySlugAny(slug: string) {
  return prisma.resource.findUnique({ where: { slug }, select: { id: true, slug: true } });
}

export type ResourceWrite = {
  slug: string;
  name: string;
  summary: string;
  description: string;
  categoryId: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  iconUrl: string | null;
  previewImageUrl: string | null;
  details: ResourceDetails;
  /** 后台保存即视为已核对 AI 补全内容 */
  aiReview?: boolean;
  pricingType: Prisma.ResourceCreateInput["pricingType"];
  status: ResourceStatus;
  tagIds: string[];
  toolIds: string[];
};

export function createResource({ tagIds, toolIds, categoryId, ...data }: ResourceWrite) {
  return prisma.resource.create({
    data: {
      ...data,
      category: { connect: { id: categoryId } },
      tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
      tools: { create: toolIds.map((toolId) => ({ tool: { connect: { id: toolId } } })) },
    },
  });
}

export function updateResource(id: string, { tagIds, toolIds, categoryId, ...data }: ResourceWrite) {
  return prisma.$transaction(async (tx) => {
    await tx.resourceTag.deleteMany({ where: { resourceId: id } });
    await tx.resourceTool.deleteMany({ where: { resourceId: id } });
    return tx.resource.update({
      where: { id },
      data: {
        ...data,
        category: { connect: { id: categoryId } },
        tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
        tools: { create: toolIds.map((toolId) => ({ tool: { connect: { id: toolId } } })) },
      },
    });
  });
}

export function setStatus(id: string, status: ResourceStatus) {
  return prisma.resource.update({
    where: { id },
    data: { status, ...(status === "published" ? {} : { featuredOrder: null }) },
    select: { slug: true },
  });
}

export function deleteResource(id: string) {
  return prisma.resource.delete({ where: { id }, select: { slug: true } });
}

/* ---------- 精选 ---------- */

export function adminListFeatured() {
  return prisma.resource.findMany({
    where: { featuredOrder: { not: null } },
    orderBy: { featuredOrder: "asc" },
    include: { category: true },
  });
}

export function adminListFeatureCandidates() {
  return prisma.resource.findMany({
    where: { ...publishedOnly, featuredOrder: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** 按给定顺序重写精选；不在列表里的全部取消精选。仅已发布资源可入选。 */
export function replaceFeatured(orderedIds: string[]) {
  return prisma.$transaction([
    prisma.resource.updateMany({ where: { featuredOrder: { not: null } }, data: { featuredOrder: null } }),
    ...orderedIds.map((id, i) =>
      prisma.resource.updateMany({ where: { id, ...publishedOnly }, data: { featuredOrder: i + 1 } }),
    ),
  ]);
}

/* ---------- AI 补全 ---------- */

const enrichSelect = {
  id: true,
  slug: true,
  name: true,
  summary: true,
  description: true,
  websiteUrl: true,
  githubUrl: true,
  previewImageUrl: true,
  pricingType: true,
  details: true,
} satisfies Prisma.ResourceSelect;

/** 从未尝试过 AI 补全的资源（是否需要补全由 service 判断）。 */
export function listEnrichCandidates() {
  return prisma.resource.findMany({ where: { aiEnrichedAt: null }, select: enrichSelect, orderBy: { createdAt: "asc" } });
}

export function findForEnrich(id: string) {
  return prisma.resource.findUnique({ where: { id }, select: enrichSelect });
}

/** 写入补全结果并记录尝试时间；filled=false 时只记录尝试。 */
export function saveEnrichment(
  id: string,
  data: { details?: ResourceDetails; previewImageUrl?: string | null; pricingType?: Prisma.ResourceCreateInput["pricingType"]; filled: boolean },
) {
  return prisma.resource.update({
    where: { id },
    data: {
      aiEnrichedAt: new Date(),
      ...(data.filled ? { aiReview: true, details: data.details, previewImageUrl: data.previewImageUrl, ...(data.pricingType ? { pricingType: data.pricingType } : {}) } : {}),
    },
    select: { slug: true },
  });
}

export const countAiReview = () => prisma.resource.count({ where: { aiReview: true } });
