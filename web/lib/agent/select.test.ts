import { describe, expect, it } from "vitest";
import { buildQueue, isKnown, rawKeys } from "./select";
import type { RawCandidate } from "./types";

const raw = (title: string, githubUrl: string | null, websiteUrl: string | null = null, source: RawCandidate["source"] = "github"): RawCandidate => ({
  source,
  sourceUrl: githubUrl ?? websiteUrl ?? "",
  title,
  websiteUrl,
  githubUrl,
  description: "",
  stars: null,
  sourceUpdatedAt: null,
});

describe("去重", () => {
  it("官网或 GitHub 任一命中已知键即视为重复；没有链接也视为不可用", () => {
    const known = new Set(["github.com/a/b", "foo.dev"]);
    expect(isKnown(rawKeys(raw("x", "https://github.com/A/B/")), known)).toBe(true);
    expect(isKnown(rawKeys(raw("x", null, "https://www.foo.dev/?utm_source=x")), known)).toBe(true);
    expect(isKnown(rawKeys(raw("x", "https://github.com/c/d", "https://c.dev")), known)).toBe(false);
    expect(isKnown([], known)).toBe(true);
  });

  it("多来源轮流交错，去掉已知与批内重复", () => {
    const known = new Set(["github.com/old/repo"]); // 例如已拒绝的候选
    const pools = [
      [raw("g1", "https://github.com/a/one"), raw("g2", "https://github.com/old/repo"), raw("g3", "https://github.com/a/three")],
      [raw("r1", "https://github.com/A/One", "https://one.dev", "mcp_registry"), raw("r2", null, "https://two.dev", "mcp_registry")],
      [raw("h1", null, "https://huggingface.co/spaces/x/y", "huggingface")],
    ];
    const { queue, duplicates } = buildQueue(pools, known);
    expect(queue.map((q) => q.title)).toEqual(["g1", "h1", "r2", "g3"]);
    expect(duplicates).toBe(2);
    expect(known.size).toBe(1); // 不修改传入的集合
  });
});
