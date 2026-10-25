import { describe, expect, it } from "vitest";
import { dragToScroll, isOverflowing, maxScroll, MIN_THUMB, thumbMetrics, thumbSize, trackClickScroll } from "./scrollbar";

const A = { viewport: 200, content: 1000, track: 192 };

describe("maxScroll / isOverflowing", () => {
  it("内容超出时为差值", () => expect(maxScroll(A)).toBe(800));
  it("内容不足时为 0", () => expect(maxScroll({ viewport: 300, content: 200 })).toBe(0));
  it("1px 子像素误差不算溢出", () => {
    expect(isOverflowing({ viewport: 200, content: 201 })).toBe(false);
    expect(isOverflowing({ viewport: 200, content: 202 })).toBe(true);
  });
  it("非数字视为 0", () => expect(maxScroll({ viewport: NaN, content: 50 })).toBe(50));
});

describe("thumbSize", () => {
  it("按可视比例缩放", () => expect(thumbSize(A)).toBe(Math.round(192 * 0.2)));
  it("不短于最小值", () => expect(thumbSize({ viewport: 100, content: 100000, track: 300 })).toBe(MIN_THUMB));
  it("不长于轨道", () => expect(thumbSize({ viewport: 500, content: 400, track: 300 })).toBe(300));
  it("轨道比最小值还短时用轨道长度", () => expect(thumbSize({ viewport: 10, content: 1000, track: 12 })).toBe(12));
  it("轨道为 0 时为 0", () => expect(thumbSize({ ...A, track: 0 })).toBe(0));
});

describe("thumbMetrics", () => {
  it("不溢出时隐藏", () => expect(thumbMetrics({ viewport: 400, content: 400, track: 390, scroll: 0 })).toEqual({ visible: false, size: 0, offset: 0 }));
  it("顶部偏移为 0", () => expect(thumbMetrics({ ...A, scroll: 0 }).offset).toBe(0));
  it("底部贴住轨道末端", () => {
    const m = thumbMetrics({ ...A, scroll: 800 });
    expect(m.offset + m.size).toBe(192);
  });
  it("中间按进度线性", () => {
    const m = thumbMetrics({ ...A, scroll: 400 });
    expect(m.offset).toBeCloseTo((192 - m.size) / 2, 1);
  });
  it("越界滚动（回弹）被夹住", () => {
    expect(thumbMetrics({ ...A, scroll: -50 }).offset).toBe(0);
    const m = thumbMetrics({ ...A, scroll: 9999 });
    expect(m.offset + m.size).toBe(192);
  });
});

describe("trackClickScroll", () => {
  const thumb = { size: 38, offset: 77 };
  const s = { ...A, scroll: 400 };
  it("点在拇指上方：上翻一页（留 10% 重叠）", () => expect(trackClickScroll(s, 10, thumb)).toBe(400 - 180));
  it("点在拇指下方：下翻一页", () => expect(trackClickScroll(s, 180, thumb)).toBe(400 + 180));
  it("点在拇指上：不动", () => expect(trackClickScroll(s, 90, thumb)).toBe(400));
  it("夹在边界内", () => {
    expect(trackClickScroll({ ...A, scroll: 50 }, 0, { size: 38, offset: 10 })).toBe(0);
    expect(trackClickScroll({ ...A, scroll: 750 }, 191, { size: 38, offset: 140 })).toBe(800);
  });
  it("overlap 可调", () => expect(trackClickScroll(s, 180, thumb, 0)).toBe(600));
});

describe("dragToScroll", () => {
  const size = 38;
  it("拇指走满活动距离 = 滚满全程", () => expect(dragToScroll(A, 0, 192 - size, size)).toBe(800));
  it("按比例换算", () => expect(dragToScroll(A, 100, 15.4, size)).toBeCloseTo(100 + 15.4 * (800 / 154), 5));
  it("反向拖动", () => expect(dragToScroll(A, 400, -77, size)).toBeCloseTo(0, 5));
  it("夹在边界内", () => {
    expect(dragToScroll(A, 0, -100, size)).toBe(0);
    expect(dragToScroll(A, 700, 500, size)).toBe(800);
  });
  it("无活动空间时保持原位", () => expect(dragToScroll({ ...A, track: size }, 300, 20, size)).toBe(300));
});
