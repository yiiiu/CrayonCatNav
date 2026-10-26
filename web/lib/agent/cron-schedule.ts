/**
 * 定时采集的时间表。Vercel Cron 只能在 vercel.json 里写死，后台改不了时间，
 * 这里与 vercel.json 的 "0 1 * * *" 保持一致（有测试校验），用于后台展示。
 */
export const COLLECT_CRON = "0 1 * * *";
export const COLLECT_CRON_UTC_HOUR = 1;

/** 下一次定时采集的时间（UTC 每天 COLLECT_CRON_UTC_HOUR:00）。 */
export function nextCollectRun(now: Date = new Date()): Date {
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), COLLECT_CRON_UTC_HOUR, 0, 0));
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

/** 北京时间的「每天 HH:00」说明。 */
export function collectScheduleLabel(): string {
  const h = (COLLECT_CRON_UTC_HOUR + 8) % 24;
  return `每天 ${String(h).padStart(2, "0")}:00（北京时间）`;
}
