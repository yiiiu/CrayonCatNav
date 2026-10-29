import "server-only";
import { prisma } from "./prisma";

/**
 * 限流计数（固定窗口）：一条 INSERT … ON CONFLICT 完成「窗口过期则重置为 1，否则 +1」，
 * 用数据库时间（各函数实例时钟不一致也不影响），并发下不会丢失更新。返回计入后的 count 与窗口结束时间、数据库当前时间。
 */
export async function incrementRateLimit(key: string, windowSec: number): Promise<{ count: number; expiresAt: Date; now: Date }> {
  const rows = await prisma.$queryRaw<{ count: number; expiresAt: Date; now: Date }[]>`
    INSERT INTO "RateLimit" ("key", "count", "expiresAt")
    VALUES (${key}, 1, now() + make_interval(secs => ${windowSec}::int))
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."expiresAt" <= now() THEN 1 ELSE "RateLimit"."count" + 1 END,
      "expiresAt" = CASE WHEN "RateLimit"."expiresAt" <= now()
        THEN now() + make_interval(secs => ${windowSec}::int) ELSE "RateLimit"."expiresAt" END
    RETURNING "count", "expiresAt", now() AS "now"`;
  return rows[0];
}

export async function deleteRateLimit(key: string): Promise<void> {
  await prisma.rateLimit.deleteMany({ where: { key } });
}

/** 删除过期超过 1 小时的计数行，返回删除条数。 */
export async function purgeExpiredRateLimits(): Promise<number> {
  const r = await prisma.rateLimit.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 60 * 60 * 1000) } } });
  return r.count;
}
