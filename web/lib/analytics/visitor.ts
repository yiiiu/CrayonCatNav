import { createHash, randomBytes } from "node:crypto";

/**
 * 当日独立访客哈希：sha256(当日盐 | IP | UA) 取前 32 位十六进制。
 * 盐每日随机生成、次日删除，所以同一访客在不同日期得到不同哈希，无法跨天关联；IP / UA 原文不落库。
 */
export function visitorHash(salt: string, ip: string, ua: string): string {
  return createHash("sha256").update(`${salt}|${ip}|${ua}`).digest("hex").slice(0, 32);
}

/** 生成新的当日盐（64 位十六进制）。 */
export function newSalt(): string {
  return randomBytes(32).toString("hex");
}

/** 从代理头取客户端 IP（Vercel 设置 x-forwarded-for / x-real-ip）；取不到返回空串。 */
export function clientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return headers.get("x-real-ip")?.trim() ?? "";
}
