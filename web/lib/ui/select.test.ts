import { describe, expect, it } from "vitest";
import { filterOptions, firstEnabled, initialActive, lastEnabled, placePopover, stepEnabled, typeahead, type SelectOption } from "./select";

const opts: SelectOption[] = [
  { value: "", label: "全部分类" },
  { value: "chat", label: "Chat 聊天", hint: "12" },
  { value: "code", label: "Code 编程", disabled: true },
  { value: "cursor", label: "Cursor" },
  { value: "draw", label: "Draw 绘画" },
  { value: "x", label: "已下架", disabled: true },
];

describe("stepEnabled", () => {
  it("跳过禁用项", () => {
    expect(stepEnabled(opts, 1, 1)).toBe(3);
    expect(stepEnabled(opts, 3, -1)).toBe(1);
  });
  it("到头不回绕", () => {
    expect(stepEnabled(opts, 4, 1)).toBe(4);
    expect(stepEnabled(opts, 0, -1)).toBe(0);
  });
  it("翻页按可选项计数，不足时停在最后一个可选项", () => {
    expect(stepEnabled(opts, 0, 1, 2)).toBe(3);
    expect(stepEnabled(opts, 0, 1, 10)).toBe(4);
  });
  it("从 -1 起步可找到第一个可选项", () => {
    expect(stepEnabled([{ disabled: true }, {}], -1, 1)).toBe(1);
  });
});

describe("first / last / initial", () => {
  it("首尾可选项", () => {
    expect(firstEnabled(opts)).toBe(0);
    expect(lastEnabled(opts)).toBe(4);
    expect(firstEnabled([{ disabled: true }])).toBe(-1);
    expect(lastEnabled([])).toBe(-1);
  });
  it("初始高亮优先已选中项，禁用或不存在时退到第一个可选项", () => {
    expect(initialActive(opts, "cursor")).toBe(3);
    expect(initialActive(opts, "code")).toBe(0);
    expect(initialActive(opts, "nope")).toBe(0);
    expect(initialActive(opts, undefined)).toBe(0);
  });
});

describe("typeahead", () => {
  it("从下一项开始找首字母，忽略大小写并跳过禁用项", () => {
    expect(typeahead(opts, "c", 0)).toBe(1);
    expect(typeahead(opts, "c", 1)).toBe(3);
  });
  it("同一字符重复按键在同首字母项间轮换并回绕", () => {
    expect(typeahead(opts, "cc", 3)).toBe(1);
  });
  it("多字符查询包含当前项，可边打边细化", () => {
    expect(typeahead(opts, "cu", 3)).toBe(3);
    expect(typeahead(opts, "cu", 0)).toBe(3);
  });
  it("中文首字", () => {
    expect(typeahead(opts, "全", 3)).toBe(0);
  });
  it("无匹配或空查询返回 -1", () => {
    expect(typeahead(opts, "zz", 0)).toBe(-1);
    expect(typeahead(opts, "  ", 0)).toBe(-1);
  });
});

describe("filterOptions", () => {
  it("按 label / hint / value 过滤，返回原下标", () => {
    expect(filterOptions(opts, "绘")).toEqual([4]);
    expect(filterOptions(opts, " CHAT ")).toEqual([1]);
    expect(filterOptions(opts, "12")).toEqual([1]);
    expect(filterOptions(opts, "cursor")).toEqual([3]);
  });
  it("空查询返回全部", () => {
    expect(filterOptions(opts, "")).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe("placePopover", () => {
  const viewport = { width: 1000, height: 800 };
  it("默认放在下方", () => {
    const p = placePopover({ trigger: { top: 100, bottom: 144, left: 50 }, viewport, contentHeight: 200, popoverWidth: 240 });
    expect(p).toEqual({ side: "bottom", offset: 150, left: 50, maxHeight: 320 });
  });
  it("下方放不下且上方更宽裕时翻到上方", () => {
    const p = placePopover({ trigger: { top: 700, bottom: 744, left: 50 }, viewport, contentHeight: 200, popoverWidth: 240 });
    expect(p.side).toBe("top");
    expect(p.offset).toBe(106);
    expect(p.maxHeight).toBe(320);
  });
  it("下方空间不足但比上方大时仍在下方并压缩高度", () => {
    const p = placePopover({ trigger: { top: 250, bottom: 294, left: 0 }, viewport: { width: 1000, height: 600 }, contentHeight: 400, popoverWidth: 240 });
    expect(p.side).toBe("bottom");
    expect(p.maxHeight).toBe(292);
    expect(p.left).toBe(8);
  });
  it("超出右侧时向左收回", () => {
    const p = placePopover({ trigger: { top: 100, bottom: 144, left: 900 }, viewport, contentHeight: 100, popoverWidth: 240 });
    expect(p.left).toBe(752);
  });
});
