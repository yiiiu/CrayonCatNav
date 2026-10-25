import { describe, expect, it } from "vitest";
import { niceMax, percent } from "./chart";

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
});
