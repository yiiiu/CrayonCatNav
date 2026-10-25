import { describe, expect, it } from "vitest";
import { dayLabel, nearestIndex, niceMax, percent, stepIndex } from "./chart";

describe("chart helpers", () => {
  it("niceMax", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(1)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(23)).toBe(25);
    expect(niceMax(101)).toBe(200);
    expect(niceMax(980)).toBe(1000);
  });
  it("percent", () => {
    expect(percent(1, 3)).toBe(33);
    expect(percent(5, 0)).toBe(0);
  });
  it("nearestIndex 吸附到最近的点并夹在两端", () => {
    // 绘图区 40..640，30 个点，间距 600/29
    expect(nearestIndex(40, 40, 600, 30)).toBe(0);
    expect(nearestIndex(640, 40, 600, 30)).toBe(29);
    expect(nearestIndex(-100, 40, 600, 30)).toBe(0);
    expect(nearestIndex(9999, 40, 600, 30)).toBe(29);
    expect(nearestIndex(40 + (600 / 29) * 10.4, 40, 600, 30)).toBe(10);
    expect(nearestIndex(40 + (600 / 29) * 10.6, 40, 600, 30)).toBe(11);
    expect(nearestIndex(300, 40, 600, 1)).toBe(0);
    expect(nearestIndex(Number.NaN, 40, 600, 30)).toBe(0);
  });
  it("stepIndex 键盘移动", () => {
    expect(stepIndex("ArrowLeft", null, 30)).toBe(28);
    expect(stepIndex("ArrowLeft", 0, 30)).toBe(0);
    expect(stepIndex("ArrowRight", 29, 30)).toBe(29);
    expect(stepIndex("ArrowRight", 3, 30)).toBe(4);
    expect(stepIndex("Home", 12, 30)).toBe(0);
    expect(stepIndex("End", 2, 30)).toBe(29);
    expect(stepIndex("a", 2, 30)).toBeNull();
    expect(stepIndex("End", null, 0)).toBeNull();
  });
  it("dayLabel", () => {
    expect(dayLabel("2026-10-25")).toBe("10月25日 周日");
    expect(dayLabel("2026-03-02")).toBe("3月2日 周一");
    expect(dayLabel("bad")).toBe("bad");
  });
});
