/**
 * 定时采集 / 审核的时间表。Vercel Hobby 每个 cron 一天只能跑一次，所以在 vercel.json 预留 4 个时段，
 * 用路径 /1../4 区分；后台「每天次数」决定哪些时段真正执行，其余时段直接跳过。
 * 时段与 vercel.json 保持一致（有测试校验）。审核排在同一时段采集的 1 小时后。
 */
export const CRON_SLOTS = [1, 2, 3, 4] as const;
export type CronSlot = (typeof CRON_SLOTS)[number];

/** 各时段采集的 UTC 小时：北京时间 09:00 / 13:00 / 17:00 / 21:00 */
export const COLLECT_SLOT_UTC_HOURS: Record<CronSlot, number> = { 1: 1, 2: 5, 3: 9, 4: 13 };
export const REVIEW_DELAY_HOURS = 1;

/** 每天 N 次时启用的时段（尽量均匀分布） */
export const SLOTS_BY_TIMES: Record<number, CronSlot[]> = { 1: [1], 2: [1, 3], 3: [1, 2, 4], 4: [1, 2, 3, 4] };

export const clampTimes = (n: number) => Math.min(4, Math.max(1, Math.round(n) || 1));

export function activeSlots(times: number): CronSlot[] {
  return SLOTS_BY_TIMES[clampTimes(times)];
}

/** 解析请求里的 slot；没带（旧配置）按第 1 时段处理，非法值返回 null。 */
export function parseSlot(v: string | null): CronSlot | null {
  if (v === null || v === "") return 1;
  const n = Number(v);
  return (CRON_SLOTS as readonly number[]).includes(n) ? (n as CronSlot) : null;
}

export function isSlotActive(times: number, slot: CronSlot): boolean {
  return activeSlots(times).includes(slot);
}

export const cronExpr = (slot: CronSlot, kind: "collect" | "review") =>
  `0 ${(COLLECT_SLOT_UTC_HOURS[slot] + (kind === "review" ? REVIEW_DELAY_HOURS : 0)) % 24} * * *`;

/** 下一次定时采集的时间（启用时段中最近的一个）。 */
export function nextCollectRun(times: number, now: Date = new Date()): Date {
  const candidates = activeSlots(times).map((s) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), COLLECT_SLOT_UTC_HOURS[s], 0, 0));
    if (d <= now) d.setUTCDate(d.getUTCDate() + 1);
    return d;
  });
  return candidates.reduce((a, b) => (b < a ? b : a));
}

const bjHour = (utc: number) => `${String((utc + 8) % 24).padStart(2, "0")}:00`;

/** 北京时间说明，如「每天 09:00、17:00（北京时间）」。 */
export function collectScheduleLabel(times: number): string {
  return `每天 ${activeSlots(times).map((s) => bjHour(COLLECT_SLOT_UTC_HOURS[s])).join("、")}（北京时间）`;
}
export function reviewScheduleLabel(times: number): string {
  return `每天 ${activeSlots(times).map((s) => bjHour(COLLECT_SLOT_UTC_HOURS[s] + REVIEW_DELAY_HOURS)).join("、")}（北京时间）`;
}
