import { describe, expect, it } from "vitest";
import { cleanReply, contextOf, INPUT_HISTORY_MAX, MAX_TURNS, parseInputs, parseStored, pushInput, serializeTurns, stepHistory, TTL_MS, type RecTurn } from "./history";

const item = (slug: string) => ({ slug, name: slug.toUpperCase(), summary: "s", category: { slug: "c", name: "C" }, tools: [], reason: "r" });
const ok = (...slugs: string[]) => ({ ok: true as const, mode: "ai" as const, items: slugs.map(item) });
const turn = (id: number, q: string, reply: RecTurn["reply"]): RecTurn => ({ id, q, reply });

describe("对话持久化", () => {
  it("序列化后可读回，未完成的轮次不保存", () => {
    const now = 1_000_000;
    const raw = serializeTurns([turn(1, "做 PPT", ok("gamma")), turn(2, "进行中", null)], now);
    const back = parseStored(raw, now + 1000);
    expect(back).toHaveLength(1);
    expect(back[0]).toMatchObject({ q: "做 PPT", reply: { ok: true, items: [{ slug: "gamma" }] } });
  });
  it("超过 30 天过期", () => {
    const raw = serializeTurns([turn(1, "做 PPT", ok("gamma"))], 0);
    expect(parseStored(raw, TTL_MS + 1)).toEqual([]);
  });
  it(`最多 ${MAX_TURNS} 轮`, () => {
    const many = Array.from({ length: MAX_TURNS + 5 }, (_, i) => turn(i + 1, `问题${i}`, ok("a")));
    const back = parseStored(serializeTurns(many, 0), 1);
    expect(back).toHaveLength(MAX_TURNS);
    expect(back[0].q).toBe("问题5");
  });
  it("损坏 / 版本不对返回空", () => {
    expect(parseStored("{oops", 0)).toEqual([]);
    expect(parseStored(JSON.stringify({ v: 2, savedAt: 0, turns: [] }), 0)).toEqual([]);
    expect(parseStored(null, 0)).toEqual([]);
  });
  it("清洗回复：丢掉多余字段与缺 slug 的条目", () => {
    const r = cleanReply({ ok: true, mode: "ai", items: [{ ...item("a"), websiteUrl: "https://x" }, { name: "无 slug" }] });
    expect(r).toEqual({ ok: true, mode: "ai", items: [item("a")] });
    expect(cleanReply({ ok: false, code: "rate_limited", message: "慢点", retryAfterSec: 3 })).toEqual({ ok: false, code: "rate_limited", message: "慢点" });
    expect(cleanReply("x")).toBeNull();
  });
});

describe("追问上文", () => {
  it("取最近 2 轮成功的问答", () => {
    const ctx = contextOf([turn(1, "一", ok("a")), turn(2, "二", { ok: false, code: "network", message: "x" }), turn(3, "三", ok("b", "c")), turn(4, "四", ok("d"))]);
    expect(ctx).toEqual([
      { q: "三", slugs: ["b", "c"] },
      { q: "四", slugs: ["d"] },
    ]);
  });
});

describe("输入历史", () => {
  it("去重后放到末尾，最多 20 条", () => {
    let list: string[] = [];
    for (let i = 0; i < INPUT_HISTORY_MAX + 3; i++) list = pushInput(list, `q${i}`);
    expect(list).toHaveLength(INPUT_HISTORY_MAX);
    list = pushInput(list, "q5");
    expect(list.at(-1)).toBe("q5");
    expect(list.filter((x) => x === "q5")).toHaveLength(1);
  });
  it("解析容错", () => {
    expect(parseInputs('["a", 1, "", "b"]')).toEqual(["a", "b"]);
    expect(parseInputs("bad")).toEqual([]);
  });
  it("↑ 往旧翻，↓ 翻回草稿，到头不动", () => {
    const list = ["a", "b"];
    expect(stepHistory(list, 2, -1, "草稿")).toEqual({ index: 1, value: "b" });
    expect(stepHistory(list, 1, -1, "草稿")).toEqual({ index: 0, value: "a" });
    expect(stepHistory(list, 0, -1, "草稿")).toBeNull();
    expect(stepHistory(list, 1, 1, "草稿")).toEqual({ index: 2, value: "草稿" });
    expect(stepHistory(list, 2, 1, "草稿")).toBeNull();
    expect(stepHistory([], 0, -1, "")).toBeNull();
  });
});
