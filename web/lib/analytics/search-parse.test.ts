import { describe, expect, it } from "vitest";
import { aggregateBing, bingSummary, displayPage, gscRange, gscSummary, parseBingDate, parseBingStats, parseGscRows } from "./search-parse";

describe("GSC 解析", () => {
  it("解析 rows", () => {
    const rows = parseGscRows({
      rows: [{ keys: ["mcp 配置"], clicks: 12, impressions: 300, ctr: 0.04, position: 7.25 }],
      responseAggregationType: "byProperty",
    });
    expect(rows).toEqual([{ key: "mcp 配置", clicks: 12, impressions: 300, ctr: 0.04, position: 7.25 }]);
  });
  it("无数据时没有 rows 字段 → 空数组", () => expect(parseGscRows({ responseAggregationType: "auto" })).toEqual([]));
  it("结构异常抛错", () => {
    expect(() => parseGscRows(null)).toThrow();
    expect(() => parseGscRows({ rows: "x" })).toThrow();
  });
  it("缺失数值按 0 处理", () => {
    expect(parseGscRows({ rows: [{ keys: [], clicks: "x" }] })[0]).toEqual({ key: "", clicks: 0, impressions: 0, ctr: 0, position: 0 });
  });
  it("汇总：totals 为不分组的一行；无数据时全 0", () => {
    const r = { start: "2026-09-27", end: "2026-10-24" };
    const s = gscSummary(r, [{ key: "", clicks: 5, impressions: 100, ctr: 0.05, position: 9 }], [], []);
    expect(s).toMatchObject({ clicks: 5, impressions: 100, ctr: 0.05, position: 9, start: "2026-09-27" });
    expect(gscSummary(r, [], [], []).clicks).toBe(0);
  });
  it("日期范围：PT 昨天往前共 28 天", () => {
    // 2026-10-25 03:00 UTC = PT 10-24 20:00 → end 10-23
    expect(gscRange(new Date("2026-10-25T03:00:00Z"))).toEqual({ start: "2026-09-26", end: "2026-10-23" });
  });
});

describe("Bing 解析与聚合", () => {
  it("解析 /Date(ms-0700)/ 与 ISO", () => {
    expect(parseBingDate("/Date(1316156400000-0700)/")).toBe(1316156400000);
    expect(parseBingDate("/Date(1316156400000)/")).toBe(1316156400000);
    expect(parseBingDate("2011-09-16T00:00:00-07:00")).toBe(Date.parse("2011-09-16T00:00:00-07:00"));
    expect(Number.isNaN(parseBingDate(null))).toBe(true);
  });
  it("解析 { d: [...] }，排名优先取曝光平均排名", () => {
    const rows = parseBingStats({
      d: [{ __type: "QueryStats:#Microsoft.Bing.Webmaster.Api", AvgClickPosition: 18, AvgImpressionPosition: 17, Clicks: 15, Date: "/Date(1316156400000-0700)/", Impressions: 100, Query: "query" }],
    });
    expect(rows).toEqual([{ key: "query", date: 1316156400000, clicks: 15, impressions: 100, position: 17 }]);
  });
  it("d 为 null → 空；结构异常抛错", () => {
    expect(parseBingStats({ d: null })).toEqual([]);
    expect(() => parseBingStats({ d: {} })).toThrow();
    expect(() => parseBingStats("x")).toThrow();
  });
  it("按词聚合：只取窗口内，曝光加权排名，按点击排序", () => {
    const since = 1000;
    const rows = [
      { key: "a", date: 2000, clicks: 2, impressions: 100, position: 10 },
      { key: "a", date: 3000, clicks: 3, impressions: 300, position: 6 },
      { key: "b", date: 2000, clicks: 9, impressions: 50, position: 2 },
      { key: "a", date: 500, clicks: 100, impressions: 100, position: 1 }, // 窗口外
      { key: "", date: 2000, clicks: 1, impressions: 1, position: 1 },
    ];
    const out = aggregateBing(rows, since);
    expect(out.map((x) => x.key)).toEqual(["b", "a"]);
    expect(out[1]).toEqual({ key: "a", clicks: 5, impressions: 400, ctr: 5 / 400, position: 7 });
  });
  it("汇总：总量来自每日流量，排名为查询词加权", () => {
    const now = new Date("2026-10-25T00:00:00Z");
    const d = (iso: string) => Date.parse(iso);
    const s = bingSummary(
      now,
      [
        { key: "", date: d("2026-10-20T00:00:00Z"), clicks: 4, impressions: 40, position: 0 },
        { key: "", date: d("2026-08-01T00:00:00Z"), clicks: 99, impressions: 999, position: 0 },
      ],
      [{ key: "q", date: d("2026-10-19T00:00:00Z"), clicks: 4, impressions: 40, position: 3 }],
      [{ key: "https://x.app/tools/mcp-config", date: d("2026-10-19T00:00:00Z"), clicks: 4, impressions: 40, position: 3 }],
    );
    expect(s).toMatchObject({ clicks: 4, impressions: 40, ctr: 0.1, position: 3, end: "2026-10-25", start: "2026-09-27" });
    expect(s.queries[0].key).toBe("q");
    expect(s.pages[0].key).toBe("https://x.app/tools/mcp-config");
  });
  it("落地页显示为路径", () => {
    expect(displayPage("https://x.app/resources/%E4%B8%AD?a=1")).toBe("/resources/中?a=1");
    expect(displayPage("not-url")).toBe("not-url");
  });
});
