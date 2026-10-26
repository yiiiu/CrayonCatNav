import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COLLECT_CRON, collectScheduleLabel, nextCollectRun } from "./cron-schedule";

describe("cron-schedule", () => {
  it("与 vercel.json 保持一致", () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as { crons: { path: string; schedule: string }[] };
    expect(cfg.crons.find((c) => c.path === "/api/cron/collect")?.schedule).toBe(COLLECT_CRON);
  });
  it("当天未到点取当天，过点取次日", () => {
    expect(nextCollectRun(new Date("2026-10-26T00:30:00Z")).toISOString()).toBe("2026-10-26T01:00:00.000Z");
    expect(nextCollectRun(new Date("2026-10-26T01:00:00Z")).toISOString()).toBe("2026-10-27T01:00:00.000Z");
    expect(nextCollectRun(new Date("2026-10-31T13:00:00Z")).toISOString()).toBe("2026-11-01T01:00:00.000Z");
  });
  it("北京时间说明", () => {
    expect(collectScheduleLabel()).toBe("每天 09:00（北京时间）");
  });
});
