import { describe, expect, it } from "vitest";
import { candidateReturnUrl } from "./candidate-return";

const q = (url: string) => new URL(url, "http://x").searchParams;

describe("candidateReturnUrl", () => {
  it("保留分类筛选", () => {
    const s = q(candidateReturnUrl({ status: "pending", cat: "agent-skills" }, "已上架「x」"));
    expect(s.get("cat")).toBe("agent-skills");
    expect(s.get("status")).toBeNull();
    expect(s.get("done")).toBe("已上架「x」");
  });
  it("保留非默认状态与页码", () => {
    const s = q(candidateReturnUrl({ status: "drafted", cat: "mcp", page: 3 }, "ok"));
    expect(s.get("status")).toBe("drafted");
    expect(s.get("page")).toBe("3");
  });
  it("无筛选时只带提示", () => {
    expect(candidateReturnUrl(null, "ok")).toBe("/admin/candidates?done=ok");
  });
  it("丢弃非法状态与页码", () => {
    expect(candidateReturnUrl({ status: "evil", page: 9999 }, "ok")).toBe("/admin/candidates?done=ok");
  });
  it("分类值被编码，始终留在候选箱", () => {
    const url = candidateReturnUrl({ cat: "../x?y=1&status=rejected" }, "ok");
    expect(url.startsWith("/admin/candidates?")).toBe(true);
    const s = q(url);
    expect(s.get("cat")).toBe("../x?y=1&status=rejected");
    expect(s.get("status")).toBeNull();
  });
});
