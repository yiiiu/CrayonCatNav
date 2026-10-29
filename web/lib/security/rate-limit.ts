import "server-only";
import { deleteRateLimit, incrementRateLimit, purgeExpiredRateLimits } from "@/lib/data/rate-limit.repo";
import { type Bucket, combine, decide, type HitResult, rateKey } from "./rate-limit-core";

export * from "./rate-limit-core";

/** 每次计数时顺带清理过期行的概率 */
const PURGE_CHANCE = 0.01;

const secret = () => process.env.AUTH_SECRET ?? "";

/**
 * 计一次并判断是否放行（跨函数实例可靠，计数存 Postgres）。
 * 数据库出错直接抛出：调用方应当拒绝请求，不能在限流失效时放行。
 */
export async function hit(bucket: Bucket, subject: string): Promise<HitResult> {
  const { count, expiresAt, now } = await incrementRateLimit(rateKey(bucket, subject, secret()), bucket.windowSec);
  if (Math.random() < PURGE_CHANCE) void purgeExpiredRateLimits().catch(() => {});
  return decide(bucket, Number(count), new Date(expiresAt), new Date(now));
}

/** 同时计多个桶（每个都会计数），任一超限即拒绝。 */
export async function hitAll(checks: [Bucket, string][]): Promise<{ ok: boolean; retryAfterSec: number }> {
  const results = await Promise.all(checks.map(([b, s]) => hit(b, s)));
  return combine(results);
}

/** 清零某个桶（如登录成功后清掉「邮箱 + IP」计数）。 */
export async function reset(bucket: Bucket, subject: string): Promise<void> {
  await deleteRateLimit(rateKey(bucket, subject, secret()));
}

export { purgeExpiredRateLimits };
