import { describe, expect, it } from "vitest";
import { cleanModelDetails, hasDetails, linesToList, readDetails } from "./resource-details";

describe("linesToList", () => {
  it("去列表符号与空行并限制条数", () => {
    expect(linesToList("- 读写文件\n\n2. 执行测试\n• 提交 Git\nx\ny", 4)).toEqual(["读写文件", "执行测试", "提交 Git", "x"]);
  });
});

describe("readDetails", () => {
  it("旧数据与脏数据容错为空", () => {
    expect(hasDetails(readDetails(null))).toBe(false);
    expect(hasDetails(readDetails({ highlights: "oops" }))).toBe(false);
  });
  it("合法数据原样读出", () => {
    expect(readDetails({ highlights: ["a"], platforms: ["cli"] })).toMatchObject({ highlights: ["a"], platforms: ["cli"], quickstart: "" });
  });
});

describe("cleanModelDetails", () => {
  it("丢弃非法平台与非字符串", () => {
    const d = cleanModelDetails({ highlights: ["a", 1, " "], platforms: ["cli", "mars", "cli"], quickstart: 3 });
    expect(d).toEqual({ highlights: ["a"], useCases: [], quickstart: "", platforms: ["cli"], pricingNote: "" });
  });
  it("截断条数", () => {
    expect(cleanModelDetails({ highlights: Array(10).fill("x") }).highlights).toHaveLength(6);
  });
});
