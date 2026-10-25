import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 定时任务鉴权：Vercel Cron 会带上 `Authorization: Bearer ${CRON_SECRET}`。
 * 未配置 CRON_SECRET 时一律拒绝（不允许匿名触发采集）。比较用定长哈希 + timingSafeEqual。
 */
export function checkCronAuth(header: string | null, secret: string | undefined): "ok" | "unconfigured" | "denied" {
  const s = secret?.trim();
  if (!s) return "unconfigured";
  if (!header) return "denied";
  const h = (v: string) => createHash("sha256").update(v).digest();
  return timingSafeEqual(h(header), h(`Bearer ${s}`)) ? "ok" : "denied";
}
