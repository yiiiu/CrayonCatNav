/**
 * Google Search Console / Bing Webmaster 响应解析与聚合（纯函数，便于单测）。
 * 统一输出 SearchSummary：近 28 天点击、曝光、CTR、平均排名 + Top 查询词 / Top 落地页。
 */

export type SearchRow = { key: string; clicks: number; impressions: number; ctr: number; position: number };

export type SearchSummary = {
  start: string; // YYYY-MM-DD
  end: string;
  clicks: number;
  impressions: number;
  ctr: number; // 0–1
  position: number; // 平均排名，0 表示无数据
  queries: SearchRow[];
  pages: SearchRow[];
};

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/* ---------------- 日期 ---------------- */

/** tz 时区下的 YYYY-MM-DD */
export function dayIn(tz: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** GSC 日期按太平洋时间：结束于 PT 昨天，向前共 28 天（含两端）。 */
export function gscRange(now: Date = new Date()): { start: string; end: string } {
  const end = shiftDay(dayIn("America/Los_Angeles", now), -1);
  return { start: shiftDay(end, -27), end };
}

/* ---------------- Google Search Console ---------------- */

/** 解析 searchAnalytics.query 响应的 rows；结构不符直接抛错（由调用方降级为「暂时取不到」）。 */
export function parseGscRows(json: unknown): SearchRow[] {
  if (!json || typeof json !== "object") throw new Error("GSC 响应不是对象");
  const rows = (json as { rows?: unknown }).rows;
  if (rows === undefined) return []; // 无数据时 GSC 不返回 rows
  if (!Array.isArray(rows)) throw new Error("GSC rows 不是数组");
  return rows.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const keys = Array.isArray(o.keys) ? o.keys : [];
    return {
      key: typeof keys[0] === "string" ? keys[0] : "",
      clicks: num(o.clicks),
      impressions: num(o.impressions),
      ctr: num(o.ctr),
      position: num(o.position),
    };
  });
}

/** 合成 GSC 总览：totals 为不分组查询的唯一一行。 */
export function gscSummary(
  range: { start: string; end: string },
  totals: SearchRow[],
  queries: SearchRow[],
  pages: SearchRow[],
): SearchSummary {
  const t = totals[0] ?? { key: "", clicks: 0, impressions: 0, ctr: 0, position: 0 };
  return { ...range, clicks: t.clicks, impressions: t.impressions, ctr: t.ctr, position: t.position, queries, pages };
}

/* ---------------- Bing Webmaster ---------------- */

/** Bing JSON 日期："/Date(1316156400000-0700)/" → 毫秒时间戳；无法解析返回 NaN。 */
export function parseBingDate(v: unknown): number {
  if (typeof v !== "string") return Number.NaN;
  const m = /\/Date\((-?\d+)([+-]\d{4})?\)\//.exec(v);
  if (m) return Number(m[1]);
  const t = Date.parse(v); // 兼容 ISO 格式
  return Number.isNaN(t) ? Number.NaN : t;
}

export type BingStat = { key: string; date: number; clicks: number; impressions: number; position: number };

/** 解析 GetQueryStats / GetPageStats / GetRankAndTrafficStats 的 { d: [...] } 响应。 */
export function parseBingStats(json: unknown): BingStat[] {
  if (!json || typeof json !== "object") throw new Error("Bing 响应不是对象");
  const d = (json as { d?: unknown }).d;
  if (d === null || d === undefined) return [];
  if (!Array.isArray(d)) throw new Error("Bing d 不是数组");
  return d.map((r) => {
    const o = (r ?? {}) as Record<string, unknown>;
    const pos = num(o.AvgImpressionPosition) || num(o.AvgClickPosition);
    return {
      key: typeof o.Query === "string" ? o.Query : "",
      date: parseBingDate(o.Date),
      clicks: num(o.Clicks),
      impressions: num(o.Impressions),
      position: pos > 0 ? pos : 0,
    };
  });
}

/** 按 key 聚合 since 之后的周数据：点击/曝光求和，排名按曝光加权平均；按点击、曝光降序取前 limit。 */
export function aggregateBing(rows: BingStat[], sinceMs: number, limit = 10): SearchRow[] {
  const acc = new Map<string, { clicks: number; impressions: number; posW: number; posN: number }>();
  for (const r of rows) {
    if (!r.key || !(r.date >= sinceMs)) continue;
    const a = acc.get(r.key) ?? { clicks: 0, impressions: 0, posW: 0, posN: 0 };
    a.clicks += r.clicks;
    a.impressions += r.impressions;
    if (r.position > 0) {
      const w = r.impressions > 0 ? r.impressions : 1;
      a.posW += r.position * w;
      a.posN += w;
    }
    acc.set(r.key, a);
  }
  return [...acc.entries()]
    .map(([key, a]) => ({
      key,
      clicks: a.clicks,
      impressions: a.impressions,
      ctr: a.impressions > 0 ? a.clicks / a.impressions : 0,
      position: a.posN > 0 ? a.posW / a.posN : 0,
    }))
    .sort((x, y) => y.clicks - x.clicks || y.impressions - x.impressions || x.key.localeCompare(y.key))
    .slice(0, limit);
}

/** 合成 Bing 总览：总点击/曝光取自每日流量（GetRankAndTrafficStats），排名取查询词的曝光加权。 */
export function bingSummary(
  now: Date,
  traffic: BingStat[],
  queryStats: BingStat[],
  pageStats: BingStat[],
  days = 28,
): SearchSummary {
  const sinceMs = now.getTime() - days * 86_400_000;
  let clicks = 0;
  let impressions = 0;
  for (const r of traffic) {
    if (r.date >= sinceMs) {
      clicks += r.clicks;
      impressions += r.impressions;
    }
  }
  const allQueries = aggregateBing(queryStats, sinceMs, Number.MAX_SAFE_INTEGER);
  let posW = 0;
  let posN = 0;
  for (const q of allQueries) {
    if (q.position > 0) {
      const w = q.impressions || 1;
      posW += q.position * w;
      posN += w;
    }
  }
  const end = new Date(now.getTime()).toISOString().slice(0, 10);
  return {
    start: new Date(sinceMs).toISOString().slice(0, 10),
    end,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: posN > 0 ? posW / posN : 0,
    queries: allQueries.slice(0, 10),
    pages: aggregateBing(pageStats, sinceMs, 10),
  };
}

/** 落地页 URL 显示为路径（同站时），便于在窄卡片里阅读。 */
export function displayPage(url: string): string {
  try {
    const u = new URL(url);
    return decodeURIComponent(u.pathname + u.search) || "/";
  } catch {
    return url;
  }
}
