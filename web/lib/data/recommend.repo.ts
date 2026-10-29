import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { cacheTags } from "@/lib/cache/tags";
import { SETTING_ID } from "./agent.repo";
import { prisma } from "./prisma";

/** 前台推荐 Agent 的数据访问：开关读取、结果缓存（规格 docs/spec/前台推荐Agent方案.md）。 */

/** 前台推荐是否开启（只读、带缓存，首页用；不触发设置单例的 upsert）。后台保存设置时 updateTag 失效。 */
export async function getRecommendEnabled(): Promise<boolean> {
  "use cache";
  cacheLife("hours");
  cacheTag(cacheTags.recommend);
  const s = await prisma.agentSetting.findUnique({ where: { id: SETTING_ID }, select: { recommendEnabled: true } });
  return !!s?.recommendEnabled;
}

export async function getRecommendCache(key: string): Promise<Prisma.JsonValue | null> {
  const row = await prisma.recommendCache.findUnique({ where: { key } });
  return row && row.expiresAt > new Date() ? row.result : null;
}

export async function setRecommendCache(key: string, result: Prisma.InputJsonValue, ttlMs: number) {
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.recommendCache.upsert({ where: { key }, create: { key, result, expiresAt }, update: { result, expiresAt } });
}

export async function purgeExpiredRecommendCache(): Promise<number> {
  const r = await prisma.recommendCache.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return r.count;
}
