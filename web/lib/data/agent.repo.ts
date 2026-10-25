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

export function createRun(trigger: "manual" | "cron" | "link") {
  return prisma.collectRun.create({ data: { trigger } });
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
  return prisma.collectRun.findMany({ orderBy: { startedAt: "desc" }, take: limit });
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
    prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, slug: true, name: true } }),
    prisma.tool.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, slug: true, name: true, description: true } }),
  ]);
  return { categories, tags, tools };
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

export async function listCandidates(status: CandidateStatus, page: number) {
  const where = { status };
  const [total, items] = await Promise.all([
    prisma.resourceCandidate.count({ where }),
    prisma.resourceCandidate.findMany({
      where,
      orderBy: status === "pending" ? [{ confidence: "desc" }, { createdAt: "desc" }] : [{ reviewedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * CANDIDATE_PAGE_SIZE,
      take: CANDIDATE_PAGE_SIZE,
      include: { resource: { select: { id: true, slug: true, status: true } } },
    }),
  ]);
  return { total, items, pageSize: CANDIDATE_PAGE_SIZE };
}

export async function countCandidatesByStatus() {
  const rows = await prisma.resourceCandidate.groupBy({ by: ["status"], _count: { _all: true } });
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
  allTags: () => prisma.tag.findMany({ select: { id: true, name: true, slug: true } }),
  toolsBySlugs: (slugs: string[]) => prisma.tool.findMany({ where: { slug: { in: slugs } }, select: { id: true } }),
  resourceUrls: () => prisma.resource.findMany({ select: { name: true, websiteUrl: true, githubUrl: true } }),
};
