import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearHitCache, hitQueryUrl, HIT_CACHE_MS, parseHits, termHits, termHitsBatch } from "./term-hits";

beforeEach(() => clearHitCache());

describe("命中校验", () => {
  it("按字段拼查询地址", () => {
    expect(decodeURIComponent(hitQueryUrl("githubTopics", "rag", 100))).toContain("q=topic:rag stars:>=100");
    expect(decodeURIComponent(hitQueryUrl("githubKeywords", "agent ui", 50))).toContain('q="agent ui" in:name,description,topics stars:>=50');
    expect(hitQueryUrl("hfSearch", "tts", 0)).toBe("https://huggingface.co/api/spaces?search=tts&limit=100");
  });
  it("解析 GitHub total_count 与 HF 条数（满 100 记为截断）", () => {
    expect(parseHits("githubTopics", { total_count: 1240, items: [] })).toEqual({ hits: 1240, capped: false });
    expect(parseHits("hfSearch", Array.from({ length: 100 }, () => ({})))).toEqual({ hits: 100, capped: true });
    expect(() => parseHits("githubTopics", { message: "rate limit" })).toThrow();
  });
  it("失败返回 null；成功结果缓存 24 小时", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ total_count: 7 }).mockResolvedValueOnce({ total_count: 9 });
    expect(await termHits("githubTopics", "rag", { minStars: 100, fetcher, now: 0 })).toEqual({ hits: 7, capped: false });
    expect(await termHits("githubTopics", "rag", { minStars: 100, fetcher, now: HIT_CACHE_MS - 1 })).toEqual({ hits: 7, capped: false });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await termHits("githubTopics", "rag", { minStars: 100, fetcher, now: HIT_CACHE_MS + 1 })).toEqual({ hits: 9, capped: false });
    const bad = vi.fn().mockRejectedValue(new Error("HTTP 403"));
    expect(await termHits("githubTopics", "x", { minStars: 100, fetcher: bad })).toBeNull();
  });
  it("带 Token 时发授权头", async () => {
    const fetcher = vi.fn().mockResolvedValue({ total_count: 1 });
    await termHits("githubKeywords", "a b", { minStars: 1, githubToken: "t", fetcher });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ authorization: "Bearer t" });
  });
  it("无 Token 时只校验前 N 个，有 Token 或 HF 全部校验", async () => {
    const fetcher = vi.fn().mockResolvedValue({ total_count: 3 });
    const r = await termHitsBatch("githubTopics", ["a", "b", "c"], { minStars: 1, maxUnauth: 2, fetcher });
    expect(r.map((x) => x?.hits ?? null)).toEqual([3, 3, null]);
    const r2 = await termHitsBatch("githubTopics", ["d", "e", "f"], { minStars: 1, maxUnauth: 2, githubToken: "t", fetcher });
    expect(r2.every((x) => x !== null)).toBe(true);
    const hf = vi.fn().mockResolvedValue([{}, {}]);
    const r3 = await termHitsBatch("hfSearch", ["g", "h", "i"], { minStars: 1, maxUnauth: 1, fetcher: hf });
    expect(r3.map((x) => x?.hits)).toEqual([2, 2, 2]);
  });
});
