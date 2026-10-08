import { describe, expect, it } from "vitest";
import { accentFor, hostOf, monogram } from "./accent";

describe("accent helpers", () => {
  it("monogram", () => {
    expect(monogram("GitHub MCP Server")).toBe("GM");
    expect(monogram("Cursor")).toBe("Cu");
    expect(monogram("蜡笔猫")).toBe("蜡");
  });
  it("accentFor 稳定", () => expect(accentFor("mcp")).toBe(accentFor("mcp")));
  it("hostOf", () => expect(hostOf("https://www.ollama.com/x")).toBe("ollama.com"));
});
