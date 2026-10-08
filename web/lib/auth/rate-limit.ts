/**
 * 登录限流：固定窗口计数。
 * 注意：内存实现仅对单实例有效；上线 Vercel 多实例前替换为 Upstash/数据库计数（见架构 §5）。
 */
const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const buckets = new Map<string, { count: number; resetAt: number }>();

export function hitLoginLimit(key: string, now = Date.now()): boolean {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  b.count += 1;
  return b.count > MAX_ATTEMPTS;
}

export function resetLoginLimit(key: string) {
  buckets.delete(key);
}
