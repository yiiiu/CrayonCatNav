import { describe, expect, it } from "vitest";
import { featuredIds, moveById, moveItem, previewOrder, sameOrder, toFeaturedFormData } from "./reorder";

const L = ["a", "b", "c", "d"].map((id) => ({ id }));
const ids = (xs: { id: string }[]) => xs.map((x) => x.id).join("");

describe("moveItem", () => {
  it("向下移动", () => expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]));
  it("向上移动", () => expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]));
  it("原地不变且返回新数组", () => {
    const src = [1, 2, 3];
    const out = moveItem(src, 1, 1);
    expect(out).toEqual(src);
    expect(out).not.toBe(src);
  });
  it("越界不变", () => {
    expect(moveItem([1, 2], -1, 1)).toEqual([1, 2]);
    expect(moveItem([1, 2], 0, 5)).toEqual([1, 2]);
  });
  it("不修改原数组", () => {
    const src = [1, 2, 3];
    moveItem(src, 0, 2);
    expect(src).toEqual([1, 2, 3]);
  });
});

describe("moveById / previewOrder", () => {
  it("按 id 移动", () => expect(ids(moveById(L, "a", "c"))).toBe("bcad"));
  it("over 为空或未知时不变", () => {
    expect(ids(moveById(L, "a", null))).toBe("abcd");
    expect(ids(moveById(L, "x", "c"))).toBe("abcd");
  });
  it("拖动中预览顺序（序号徽章实时更新）", () => {
    expect(ids(previewOrder(L, "d", "b"))).toBe("adbc");
    expect(ids(previewOrder(L, null, "b"))).toBe("abcd");
  });
  it("sameOrder", () => {
    expect(sameOrder(L, [...L])).toBe(true);
    expect(sameOrder(L, moveItem(L, 0, 1))).toBe(false);
    expect(sameOrder(L, L.slice(1))).toBe(false);
  });
});

describe("提交载荷", () => {
  it("ids 去重去空并保持顺序", () => {
    expect(featuredIds([{ id: "b" }, { id: "" }, { id: "a" }, { id: "b" }])).toEqual(["b", "a"]);
  });
  it("FormData 与原表单一致：多个 ids", () => {
    const fd = toFeaturedFormData(moveById(L, "c", "a"));
    expect(fd.getAll("ids")).toEqual(["c", "a", "b", "d"]);
  });
  it("空列表提交空载荷（清空精选）", () => {
    expect(toFeaturedFormData([]).getAll("ids")).toEqual([]);
  });
});
