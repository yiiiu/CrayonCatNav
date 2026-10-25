import { describe, expect, it } from "vitest";
import { DEFAULT_COLLECT_CONFIGS, type CollectConfig } from "@/lib/validation/collect-config";
import { activeSources, applyTargetCategory, isCollectable, OFF_TARGET_MAX_CONFIDENCE, pickTargetCategory, type CategoryStat, type GlobalSources } from "./category-target";

const allOn: GlobalSources = { github: true, mcpRegistry: true, awesome: true, huggingface: true, productHunt: true };
const cfg = (patch: Partial<CollectConfig> = {}): CollectConfig => ({ ...DEFAULT_COLLECT_CONFIGS["agent-skills"], ...patch });
const stat = (slug: string, sortOrder: number, published: number, pending: number, config: CollectConfig | null = cfg()): CategoryStat => ({
  id: `id-${slug}`,
  slug,
  name: slug,
  sortOrder,
  published,
  pending,
  config,
});

describe("来源过滤", () => {
  it("只保留分类开启且全局也开启的来源", () => {
    const mcp = DEFAULT_COLLECT_CONFIGS.mcp;
    expect(activeSources(mcp, allOn)).toEqual(["github", "mcpRegistry", "awesome"]);
    expect(activeSources(mcp, { ...allOn, awesome: false, github: false })).toEqual(["mcpRegistry"]);
    // 分类没开的来源，全局开着也不跑
    expect(activeSources(mcp, allOn)).not.toContain("huggingface");
  });
  it("非 MCP 分类默认不跑 MCP Registry / awesome", () => {
    for (const slug of ["ai-coding", "agent-skills", "models-api", "github-oss", "ai-creation"]) {
      const s = activeSources(DEFAULT_COLLECT_CONFIGS[slug], allOn);
      expect(s).not.toContain("mcpRegistry");
      expect(s).not.toContain("awesome");
    }
  });
});

describe("自动选分类", () => {
  it("选「已上架 + 待审核」最少的分类", () => {
    const stats = [stat("a", 0, 10, 2), stat("b", 1, 3, 1), stat("c", 2, 6, 0)];
    expect(pickTargetCategory(stats, allOn)?.slug).toBe("b");
  });
  it("待审核也计入", () => {
    const stats = [stat("a", 0, 2, 9), stat("b", 1, 5, 0)];
    expect(pickTargetCategory(stats, allOn)?.slug).toBe("b");
  });
  it("并列时按 sortOrder，再按 slug", () => {
    expect(pickTargetCategory([stat("x", 3, 4, 0), stat("y", 1, 2, 2), stat("z", 2, 4, 0)], allOn)?.slug).toBe("y");
    expect(pickTargetCategory([stat("b", 1, 1, 0), stat("a", 1, 0, 1)], allOn)?.slug).toBe("a");
  });
  it("跳过未配置、已关闭、来源全被全局关掉的分类", () => {
    const stats = [
      stat("none", 0, 0, 0, null),
      stat("off", 1, 0, 0, cfg({ enabled: false })),
      stat("hfOnly", 2, 0, 0, cfg({ sources: { github: false, mcpRegistry: false, awesome: false, huggingface: true, productHunt: false } })),
      stat("ok", 3, 50, 5),
    ];
    const global = { ...allOn, huggingface: false };
    expect(pickTargetCategory(stats, global)?.slug).toBe("ok");
    expect(isCollectable(stats[0], global)).toBe(false);
    expect(isCollectable(stats[2], allOn)).toBe(true);
  });
  it("没有可选分类时返回 null", () => {
    expect(pickTargetCategory([stat("none", 0, 0, 0, null)], allOn)).toBeNull();
    expect(pickTargetCategory([], allOn)).toBeNull();
  });
});

describe("目标分类修正", () => {
  const base = { payload: { categorySlug: "mcp" }, reason: "很实用", confidence: 0.9 };
  it("归入目标分类时原样返回", () => {
    expect(applyTargetCategory(base, { slug: "mcp", name: "MCP 服务" })).toBe(base);
    expect(applyTargetCategory(base, null)).toBe(base);
  });
  it("归到别的分类时压低置信度并在 reason 标明", () => {
    const r = applyTargetCategory(base, { slug: "ai-creation", name: "AI 创作" });
    expect(r.confidence).toBe(OFF_TARGET_MAX_CONFIDENCE);
    expect(r.reason).toBe("【不属于目标分类「AI 创作」】很实用");
    expect(r.payload.categorySlug).toBe("mcp");
  });
  it("模型已经说明时不重复加前缀，低置信度保持不变", () => {
    const r = applyTargetCategory({ ...base, reason: "不属于目标分类：这是 MCP 服务", confidence: 0.3 }, { slug: "ai-creation", name: "AI 创作" });
    expect(r.reason).toBe("不属于目标分类：这是 MCP 服务");
    expect(r.confidence).toBe(0.3);
  });
});
