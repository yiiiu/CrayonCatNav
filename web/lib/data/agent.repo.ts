import "server-only";
import type { CandidateStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/** 采集 Agent 的数据访问：设置单例、运行锁、运行记录、候选箱。后台专用，不缓存。 */

export const SETTING_ID = "singleton";

/* ---------- 设置 ---------- */

export function getSetting() {
  return prisma.agentSetting.upsert({ where: { id: SETTING_ID }, create: { id: SETTING_ID }, update: {} });
}

export type SettingWrite = Omit<Prisma.AgentSettingUpdateInput, "id" | "lockedUntil" | "updatedAt">;

export function updateSetting(data: SettingWrite) {
  return prisma.agentSetting.upsert({
    where: { id: SETTING_ID },
    create: { id: SETTING_ID, ...(data as Prisma.AgentSettingCreateInput) },
    update: data,
  });
}

/* ---------- 运行锁（同一时间只允许一个采集） ---------- */

/** 原子抢锁：锁为空或已过期才能拿到。返回是否成功。 */
export async function acquireLock(ttlMs: number) {
  await getSetting(); // 确保单例存在
  const now = new Date();
  const { count } = await prisma.agentSetting.updateMany({
    where: { id: SETTING_ID, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + ttlMs) },
  });
  return count === 1;
}

export function releaseLock() {
  return prisma.agentSetting.update({ where: { id: SETTING_ID }, data: { lockedUntil: null } });
}

/** 上次运行被平台强制中断（锁过期）后，残留的 running 记录标记为失败。 */
export function failStaleRuns(before: Date) {
  return prisma.collectRun.updateMany({
    where: { status: "running", startedAt: { lt: before } },
    data: { status: "failed", finishedAt: new Date(), error: "运行被中断（可能超出函数最长执行时间）" },
  });
}

/* ---------- 运行记录 ---------- */

export function createRun(trigger: "manual" | "cron" | "link", categoryId: string | null = null) {
  return prisma.collectRun.create({ data: { trigger, categoryId } });
}

export type RunFinish = {
  status: "succeeded" | "failed";
  found: number;
  created: number;
  skipped: number;
  failed: number;
  error?: string | null;
  notes?: Prisma.InputJsonValue;
  promptTokens?: number | null;
  completionTokens?: number | null;
};

export function finishRun(id: string, data: RunFinish) {
  return prisma.collectRun.update({ where: { id }, data: { ...data, finishedAt: new Date() } });
}

export function listRuns(limit = 10) {
  return prisma.collectRun.findMany({ orderBy: { startedAt: "desc" }, take: limit, include: { category: { select: { slug: true, name: true } } } });
}

/* ---------- 分类采集配置与分类计数 ---------- */

/** 全部分类（按 sortOrder）及其采集配置原始 Json（未配置为 null）。 */
export async function listCategoriesWithCollectConfig() {
  const rows = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: { id: true, slug: true, name: true, sortOrder: true, collectConfig: { select: { config: true, updatedAt: true } } },
  });
  return rows.map(({ collectConfig, ...c }) => ({ ...c, rawConfig: collectConfig?.config ?? null, configUpdatedAt: collectConfig?.updatedAt ?? null }));
}

export function findCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id }, select: { id: true, slug: true, name: true } });
}

/** 扩词用：分类的已上架资源样例（精选优先，其次最近更新），含标签名。 */
export async function listCategorySamples(categoryId: string, take = 15) {
  const rows = await prisma.resource.findMany({
    where: { categoryId, status: "published" },
    orderBy: [{ featuredOrder: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    take,
    select: { name: true, summary: true, tags: { select: { tag: { select: { name: true } } } } },
  });
  return rows.map((r) => ({ name: r.name, summary: r.summary, tags: r.tags.map((t) => t.tag.name) }));
}

export function upsertCollectConfig(categoryId: string, config: Prisma.InputJsonValue) {
  return prisma.categoryCollectConfig.upsert({ where: { categoryId }, create: { categoryId, config }, update: { config } });
}

/**
 * 各分类「已上架资源数」与「待审核候选数」。
 * 待审核按候选 payload.categorySlug 统计（Prisma 不支持按 Json 字段 groupBy，用原生 SQL）。
 */
export async function categoryCounts() {
  const [published, pending] = await Promise.all([
    prisma.resource.groupBy({ by: ["categoryId"], where: { status: "published" }, _count: { _all: true } }),
    prisma.$queryRaw<{ slug: string | null; n: bigint }[]>`
      SELECT "payload"->>'categorySlug' AS slug, COUNT(*)::bigint AS n
      FROM "ResourceCandidate" WHERE "status" = 'pending' GROUP BY 1`,
  ]);
  return {
    publishedById: new Map(published.map((r) => [r.categoryId, r._count._all])),
    pendingBySlug: new Map(pending.filter((r) => r.slug).map((r) => [r.slug as string, Number(r.n)])),
  };
}

/* ---------- 去重所需的已知链接 ---------- */

export async function loadKnownUrls() {
  const [resources, candidates] = await Promise.all([
    prisma.resource.findMany({ select: { websiteUrl: true, githubUrl: true } }),
    prisma.resourceCandidate.findMany({ select: { normalizedUrl: true, urlKeys: true } }),
  ]);
  return { resources, candidates };
}

/** 分类、标签、工具（模型的可选项）。 */
export async function loadTaxonomy() {
  const [categories, tags, tools] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true } }),
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true, aliases: true } }),
    prisma.tool.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, description: true } }),
  ]);
  return { categories, tags, tools };
}

/** 已处理过的待定词（构建词表时用：已忽略的建议词不再推送）。 */
export function loadClosedSuggestions() {
  return prisma.tagSuggestion.findMany({ where: { status: "ignored" }, select: { name: true, slug: true, status: true } });
}

/**
 * 候选入库后把模型建议的新标签记入待定池：按 slug upsert，已存在则 hits + 1 并记下候选 id。
 * 已启用 / 已归并的词理论上已能被词表识别，不会走到这里；已忽略的不改状态，只累计次数。
 */
export async function recordTagSuggestions(candidateId: string, items: readonly { name: string; slug: string }[]) {
  for (const it of items) {
    const write = () =>
      prisma.tagSuggestion.upsert({
        where: { slug: it.slug },
        create: { name: it.name, slug: it.slug, candidateIds: [candidateId] },
        update: { hits: { increment: 1 }, candidateIds: { push: candidateId } },
      });
    try {
      await write();
    } catch (e) {
      // 并发采集同一 slug 时 create 可能撞唯一约束，重试一次即走 update
      if ((e as { code?: string }).code === "P2002") await write();
      else throw e;
    }
  }
}

/* ---------- 候选 ---------- */

export type CandidateCreate = {
  normalizedUrl: string;
  urlKeys: string[];
  name: string;
  source: string;
  sourceUrl: string;
  stars: number | null;
  sourceUpdatedAt: Date | null;
  rawSummary: string;
  payload: Prisma.InputJsonValue;
  reason: string;
  confidence: number;
  linkStatus: number | null;
  runId: string | null;
};

/** 插入候选；规范化 URL 撞唯一约束（并发或刚被别处收录）时返回 null。 */
export async function createCandidate(data: CandidateCreate) {
  try {
    return await prisma.resourceCandidate.create({ data });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return null;
    throw e;
  }
}

export const CANDIDATE_PAGE_SIZE = 20;

/** 按候选的 categorySlug（模型整理 / 管理员修改后的分类）筛选。 */
const candidateWhere = (status: CandidateStatus | undefined, categorySlug?: string | null): Prisma.ResourceCandidateWhereInput => ({
  ...(status ? { status } : {}),
  ...(categorySlug ? { payload: { path: ["categorySlug"], equals: categorySlug } } : {}),
});

export async function listCandidates(status: CandidateStatus, page: number, categorySlug?: string | null) {
  const where = candidateWhere(status, categorySlug);
  const [total, items] = await Promise.all([
    prisma.resourceCandidate.count({ where }),
    prisma.resourceCandidate.findMany({
      where,
      orderBy: status === "pending" ? [{ confidence: "desc" }, { createdAt: "desc" }] : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * CANDIDATE_PAGE_SIZE,
      take: CANDIDATE_PAGE_SIZE,
      include: {
        resource: { select: { id: true, slug: true, status: true } },
        run: { select: { category: { select: { slug: true, name: true } } } },
      },
    }),
  ]);
  return { total, items, pageSize: CANDIDATE_PAGE_SIZE };
}

export async function countCandidatesByStatus(categorySlug?: string | null) {
  const rows = await prisma.resourceCandidate.groupBy({ by: ["status"], where: candidateWhere(undefined, categorySlug), _count: { _all: true } });
  const out: Record<CandidateStatus, number> = { pending: 0, published: 0, drafted: 0, rejected: 0 };
  for (const r of rows) out[r.status] = r._count._all;
  return out;
}

export function countPending() {
  return prisma.resourceCandidate.count({ where: { status: "pending" } });
}

export function findCandidate(id: string) {
  return prisma.resourceCandidate.findUnique({ where: { id } });
}

export function updateCandidatePayload(id: string, payload: Prisma.InputJsonValue, name: string) {
  return prisma.resourceCandidate.update({ where: { id }, data: { payload, name } });
}

export function rejectCandidate(id: string) {
  return prisma.resourceCandidate.updateMany({ where: { id, status: "pending" }, data: { status: "rejected", reviewedAt: new Date() } });
}

/** 候选转资源：在一个事务里补建缺失标签、建资源、回写候选状态与 resourceId。 */
export function convertCandidateTx(args: {
  candidateId: string;
  status: "published" | "drafted";
  newTags: { name: string; slug: string }[];
  existingTagIds: string[];
  toolIds: string[];
  resource: {
    slug: string;
    name: string;
    summary: string;
    description: string;
    categoryId: string;
    websiteUrl: string | null;
    githubUrl: string | null;
    pricingType: Prisma.ResourceCreateInput["pricingType"];
    previewImageUrl: string | null;
    details: Prisma.InputJsonValue;
    status: "published" | "draft";
  };
}) {
  return prisma.$transaction(async (tx) => {
    // 只有 pending 的候选能转换，防止重复点击建出两条资源
    const claimed = await tx.resourceCandidate.updateMany({
      where: { id: args.candidateId, status: "pending" },
      data: { status: args.status, reviewedAt: new Date() },
    });
    if (claimed.count !== 1) return null;
    const tagIds = [...args.existingTagIds];
    for (const t of args.newTags) {
      const tag = await tx.tag.upsert({ where: { slug: t.slug }, create: t, update: {} });
      tagIds.push(tag.id);
      // 审核员上架时写的新标签等于直接启用：同 slug 的待定词标为已启用
      await tx.tagSuggestion.updateMany({ where: { slug: t.slug, status: "open" }, data: { status: "accepted", tagId: tag.id } });
    }
    const { categoryId, ...data } = args.resource;
    const created = await tx.resource.create({
      data: {
        ...data,
        category: { connect: { id: categoryId } },
        tags: { create: [...new Set(tagIds)].map((tagId) => ({ tag: { connect: { id: tagId } } })) },
        tools: { create: args.toolIds.map((toolId) => ({ tool: { connect: { id: toolId } } })) },
      },
      select: { id: true, slug: true },
    });
    await tx.resourceCandidate.update({ where: { id: args.candidateId }, data: { resourceId: created.id } });
    return created;
  });
}

/* ---------- 候选转资源时的查询 ---------- */

export const reviewLookups = {
  categoryBySlug: (slug: string) => prisma.category.findUnique({ where: { slug }, select: { id: true } }),
  allTags: () => prisma.tag.findMany({ select: { id: true, name: true, slug: true, aliases: true } }),
  toolsBySlugs: (slugs: string[]) => prisma.tool.findMany({ where: { slug: { in: slugs } }, select: { id: true } }),
  resourceUrls: () => prisma.resource.findMany({ select: { name: true, websiteUrl: true, githubUrl: true } }),
};
