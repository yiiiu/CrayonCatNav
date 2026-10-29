import { createHmac } from "node:crypto";

/**
 * 限流的纯逻辑（无数据库），便于单元测试。计数与存储见 lib/security/rate-limit.ts + lib/data/rate-limit.repo.ts。
 * 算法：固定窗口。每个 key 一行（count, expiresAt），窗口过期则从 1 重新计数。
 */
export type Bucket = { name: string; limit: number; windowSec: number };

export type HitResult = { ok: boolean; remaining: number; retryAfterSec: number };

/** 登录限流（规格：docs/spec/限流改数据库方案.md §4） */
export const LOGIN_IP: Bucket = { name: "login:ip", limit: 20, windowSec: 5 * 60 };
export const LOGIN_EMAIL_IP: Bucket = { name: "login:email-ip", limit: 5, windowSec: 5 * 60 };
export const LOGIN_EMAIL: Bucket = { name: "login:email", limit: 30, windowSec: 60 * 60 };

/** 取不到客户端 IP 时共用的主体：宁可误伤也不放行 */
export const UNKNOWN_IP = "unknown";

/**
 * 计数行的 key：桶名 + ":" + HMAC-SHA256(secret, subject) 前 32 位十六进制。
 * 库里只有哈希，看不到 IP / 邮箱原文；secret 用 AUTH_SECRET，换 secret 只会让旧计数作废。
 */
export function rateKey(bucket: Pick<Bucket, "name">, subject: string, secret: string): string {
  if (!secret) throw new Error("缺少 AUTH_SECRET，无法计算限流 key");
  const h = createHmac("sha256", secret).update(subject).digest("hex").slice(0, 32);
  return `${bucket.name}:${h}`;
}

/** 根据数据库返回的计数结果判断是否放行。count 是本次计入后的值。 */
export function decide(bucket: Bucket, count: number, expiresAt: Date, now: Date): HitResult {
  const ok = count <= bucket.limit;
  return {
    ok,
    remaining: Math.max(0, bucket.limit - count),
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000)),
  };
}

/** 多个桶的结果合并：任一超限即拒绝，等待时间取最长的那个。 */
export function combine(results: HitResult[]): { ok: boolean; retryAfterSec: number } {
  const blocked = results.filter((r) => !r.ok);
  return { ok: blocked.length === 0, retryAfterSec: blocked.reduce((m, r) => Math.max(m, r.retryAfterSec), 0) };
}

/** 「N 分钟」提示文案，不足 1 分钟按 1 分钟算。 */
export function retryText(sec: number): string {
  return `${Math.max(1, Math.ceil(sec / 60))} 分钟`;
}
