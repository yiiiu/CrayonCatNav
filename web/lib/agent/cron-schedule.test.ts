import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CRON_SLOTS, activeSlots, collectScheduleLabel, cronExpr, isSlotActive, nextCollectRun, parseSlot, reviewScheduleLabel } from "./cron-schedule";

describe("cron-schedule", () => {
  it("与 vercel.json 保持一致（4 个采集时段 + 4 个审核时段）", () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    const got = new Map(cfg.crons.map((c) => [c.path, c.schedule]));
    for (const s of CRON_SLOTS) {
      expect(got.get(`/api/cron/collect/${s}`)).toBe(cronExpr(s, "collect"));
      expect(got.get(`/api/cron/review/${s}`)).toBe(cronExpr(s, "review"));
    }
    expect(cfg.crons).toHaveLength(8);
  });
  it("每天次数 → 启用时段", () => {
    expect(activeSlots(1)).toEqual([1]);
    expect(activeSlots(2)).toEqual([1, 3]);
    expect(activeSlots(3)).toEqual([1, 2, 4]);
    expect(activeSlots(4)).toEqual([1, 2, 3, 4]);
    expect(activeSlots(9)).toEqual([1, 2, 3, 4]);
    expect(isSlotActive(2, 2)).toBe(false);
    expect(isSlotActive(2, 3)).toBe(true);
  });
  it("解析 slot", () => {
    expect(parseSlot(null)).toBe(1);
    expect(parseSlot("3")).toBe(3);
    expect(parseSlot("5")).toBeNull();
  });
  it("下一次运行取最近的启用时段", () => {
    expect(nextCollectRun(1, new Date("2026-10-26T00:30:00Z")).toISOString()).toBe("2026-10-26T01:00:00.000Z");
    expect(nextCollectRun(1, new Date("2026-10-26T01:00:00Z")).toISOString()).toBe("2026-10-27T01:00:00.000Z");
    expect(nextCollectRun(2, new Date("2026-10-26T02:00:00Z")).toISOString()).toBe("2026-10-26T09:00:00.000Z");
    expect(nextCollectRun(2, new Date("2026-10-26T10:00:00Z")).toISOString()).toBe("2026-10-27T01:00:00.000Z");
  });
  it("北京时间说明", () => {
    expect(collectScheduleLabel(1)).toBe("每天 09:00（北京时间）");
    expect(collectScheduleLabel(3)).toBe("每天 09:00、13:00、21:00（北京时间）");
    expect(reviewScheduleLabel(2)).toBe("每天 10:00、18:00（北京时间）");
  });
});
