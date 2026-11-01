import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const repo = vi.hoisted(() => ({
  getSetting: vi.fn(),
  loadTaxonomy: vi.fn(),
  listCategoriesWithCollectConfig: vi.fn(),
  reviewLookups: { resourceUrls: vi.fn() },
  countAiPublishedSince: vi.fn(),
  findCandidate: vi.fn(),
  countPublishedInCategory: vi.fn(),
  saveReview: vi.fn(),
  updateCandidatePayload: vi.fn(),
  listUnreviewedPending: vi.fn(),
  countUnreviewedPending: vi.fn(),
}));
vi.mock("@/lib/data/agent.repo", () => repo);

const svc = vi.hoisted(() => ({ convertCandidate: vi.fn(), rejectCandidate: vi.fn() }));
vi.mock("./candidate.service", () => svc);
vi.mock("./agent-settings.service", () => ({ loadRuntimeConfig: vi.fn(async () => ({ chat: { baseUrl: "https://m", apiKey: "k", model: "x" } })) }));

const llm = vi.hoisted(() => ({ assertBudget: vi.fn(), trackedChat: vi.fn() }));
vi.mock("./model-budget.service", () => llm);

const net = vi.hoisted(() => ({ checkLink: vi.fn(), fetchEnrichMaterial: vi.fn() }));
vi.mock("@/lib/agent/safe-fetch", () => net);

const { reviewOne, reviewPending } = await import("./review.service");

const payload = {
  name: "Filesystem MCP",
  slug: "filesystem-mcp",
  summary: "官方本地文件系统读写服务，支持指定安全沙盒目录。",
  description: "适合需要让 Agent 读写本地文件的开发者。",
  categorySlug: "mcp",
  tags: ["MCP"],
  suggestedTags: [],
  websiteUrl: null,
  githubUrl: "https://github.com/modelcontextprotocol/servers",
  pricingType: "free",
  toolSlugs: [],
  details: { highlights: [], useCases: [], quickstart: "", platforms: [], pricingNote: "" },
  previewImageUrl: null,
};

const setting = (mode: "off" | "suggest" | "auto") => ({
  reviewMode: mode,
  reviewPublishDraft: false,
  reviewApproveScore: 80,
  reviewRejectScore: 40,
  reviewDailyPublishCap: 10,
  reviewMaxPerRun: 20,
});

const modelSays = (verdict: string, score: number) => llm.trackedChat.mockResolvedValue({ content: JSON.stringify({ verdict, score, reason: "理由" }), usage: null });

beforeEach(() => {
  vi.clearAllMocks();
  repo.getSetting.mockResolvedValue(setting("suggest"));
  repo.loadTaxonomy.mockResolvedValue({ tags: [{ name: "MCP", aliases: [] }], categories: [], tools: [] });
  repo.listCategoriesWithCollectConfig.mockResolvedValue([{ slug: "mcp", name: "MCP 服务", rawConfig: null }]);
  repo.reviewLookups.resourceUrls.mockResolvedValue([]);
  repo.countAiPublishedSince.mockResolvedValue(0);
  repo.countPublishedInCategory.mockResolvedValue(10);
  repo.findCandidate.mockResolvedValue({ id: "c1", name: "Filesystem MCP", status: "pending", payload, confidence: 0.8, sourceUpdatedAt: null });
  net.checkLink.mockResolvedValue({ ok: true, status: 200, finalUrl: "x" });
  net.fetchEnrichMaterial.mockResolvedValue({ site: null, readme: "README 内容", pricing: null, previewImageUrl: null });
  svc.convertCandidate.mockResolvedValue({ resourceId: "r1", slug: "filesystem-mcp" });
  modelSays("approve", 90);
});

describe("reviewOne", () => {
  it("建议模式：只写结论，不上架", async () => {
    const r = await reviewOne("c1");
    expect(r).toMatchObject({ verdict: "approve", action: "human", score: 90 });
    expect(svc.convertCandidate).not.toHaveBeenCalled();
    expect(repo.saveReview).toHaveBeenCalledWith("c1", expect.objectContaining({ verdict: "approve", score: 90 }));
  });

  it("自动模式：高分直接发布，记为 AI 处理", async () => {
    repo.getSetting.mockResolvedValue(setting("auto"));
    const r = await reviewOne("c1");
    expect(r).toMatchObject({ action: "publish", slug: "filesystem-mcp" });
    expect(svc.convertCandidate).toHaveBeenCalledWith("c1", "publish", expect.objectContaining({ tags: "MCP" }), "ai");
  });

  it("链接全挂：不调模型，自动模式下自动拒绝", async () => {
    repo.getSetting.mockResolvedValue(setting("auto"));
    net.checkLink.mockResolvedValue({ ok: false, status: 404, finalUrl: null });
    const r = await reviewOne("c1");
    expect(r).toMatchObject({ verdict: "reject", action: "reject" });
    expect(llm.trackedChat).not.toHaveBeenCalled();
    expect(svc.rejectCandidate).toHaveBeenCalledWith("c1", "ai");
  });

  it("模型输出不合法：留人工", async () => {
    repo.getSetting.mockResolvedValue(setting("auto"));
    llm.trackedChat.mockResolvedValue({ content: "不是 JSON", usage: null });
    const r = await reviewOne("c1");
    expect(r).toMatchObject({ verdict: "unsure", action: "human" });
    expect(llm.trackedChat).toHaveBeenCalledTimes(2);
  });

  it("上架失败：回写为留人工", async () => {
    repo.getSetting.mockResolvedValue(setting("auto"));
    svc.convertCandidate.mockRejectedValue(new Error("slug 已被占用"));
    const r = await reviewOne("c1");
    expect(r).toMatchObject({ action: "human", note: "slug 已被占用" });
    expect(repo.saveReview).toHaveBeenLastCalledWith("c1", expect.objectContaining({ notes: expect.objectContaining({ action: "human" }) }));
  });
});

describe("reviewPending", () => {
  it("定时任务在关闭时跳过", async () => {
    repo.getSetting.mockResolvedValue(setting("off"));
    expect((await reviewPending("cron")).skipped).toBeTruthy();
    expect(repo.listUnreviewedPending).not.toHaveBeenCalled();
  });

  it("批量统计", async () => {
    repo.listUnreviewedPending.mockResolvedValue([{ id: "c1" }]);
    repo.countUnreviewedPending.mockResolvedValue(0);
    const r = await reviewPending("manual");
    expect(r).toMatchObject({ reviewed: 1, human: 1, failed: 0, remaining: 0 });
  });
});
