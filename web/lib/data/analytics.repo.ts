import "server-only";
import { prisma } from "@/lib/data/prisma";
import { addDays, type Device, isoDay, statDay, type TrafficSource } from "@/lib/analytics/traffic";
import { newSalt } from "@/lib/analytics/visitor";
import type { TrackEventType } from "@/lib/validation/analytics";

/* ================= 写入 ================= */

/** 业务事件（资源 / 工具）按日计数。toolSlug / resourceSlug 不存在时记为 null。 */
export async function recordEvent(day: Date, eventType: TrackEventType, toolSlug?: string, resourceSlug?: string) {
  const [tool, res] = await Promise.all([
    toolSlug ? prisma.tool.findUnique({ where: { slug: toolSlug }, select: { id: true } }) : null,
    resourceSlug ? prisma.resource.findUnique({ where: { slug: resourceSlug }, select: { id: true } }) : null,
  ]);
  const toolId = tool?.id ?? null;
  const resourceId = res?.id ?? null;
  // NULLS NOT DISTINCT 唯一索引保证同日同维度只有一行
  await prisma.$executeRaw`
    INSERT INTO "DailyMetric" ("id", "date", "eventType", "resourceId", "toolId", "count")
    VALUES (${crypto.randomUUID()}, ${isoDay(day)}::date, ${eventType}, ${resourceId}, ${toolId}, 1)
    ON CONFLICT ("date", "eventType", "resourceId", "toolId") DO UPDATE SET "count" = "DailyMetric"."count" + 1`;
}

/** 页面浏览按日聚合 +1。 */
export async function recordPageView(
  day: Date,
  v: { path: string; source: TrafficSource; refDomain: string; device: Device },
) {
  await prisma.$executeRaw`
    INSERT INTO "PageViewDaily" ("id", "date", "path", "source", "refDomain", "device", "views")
    VALUES (${crypto.randomUUID()}, ${isoDay(day)}::date, ${v.path}, ${v.source}, ${v.refDomain}, ${v.device}, 1)
    ON CONFLICT ("date", "path", "source", "refDomain", "device") DO UPDATE SET "views" = "PageViewDaily"."views" + 1`;
}

/**
 * 当日盐：不存在就随机生成（并发下以先写入者为准），同时删除所有早于今天的盐，
 * 删除后旧哈希再也无法与 IP/UA 对应。
 */
export async function dailySalt(day: Date): Promise<string> {
  await prisma.$executeRaw`
    INSERT INTO "AnalyticsSalt" ("date", "salt") VALUES (${isoDay(day)}::date, ${newSalt()})
    ON CONFLICT ("date") DO NOTHING`;
  const [row] = await Promise.all([
    prisma.analyticsSalt.findUnique({ where: { date: day }, select: { salt: true } }),
    prisma.analyticsSalt.deleteMany({ where: { date: { lt: day } } }),
  ]);
  if (!row) throw new Error("salt missing");
  return row.salt;
}

/** 记录当日访客哈希（已存在则忽略）。 */
export async function recordVisitor(day: Date, hash: string) {
  await prisma.$executeRaw`
    INSERT INTO "DailyVisitor" ("date", "hash") VALUES (${isoDay(day)}::date, ${hash})
    ON CONFLICT DO NOTHING`;
}

/* ================= 读取（后台总览） ================= */

export type DayPoint = { date: string; pv: number; uv: number };
export type CountRow = { key: string; count: number };

export type TrafficOverview = {
  today: string;
  series: DayPoint[]; // 近 30 天，含今天，缺失日补 0
  totals: { today: { pv: number; uv: number }; d7: { pv: number; uv: number }; d30: { pv: number; uv: number } };
  topPages: CountRow[];
  sources: CountRow[]; // 进站来源（不含站内跳转）
  referrers: CountRow[]; // 外链 / 社交 / 其他搜索引擎的域名
  search: { google7: number; bing7: number; google30: number; bing30: number };
  devices: CountRow[];
  events: { resource_view: number; tool_open: number; tool_execute: number; resource_to_tool_click: number };
  tools: { name: string; open: number; execute: number; click: number }[];
};

const n = (v: unknown) => Number(v ?? 0);

export async function trafficOverview(now: Date = new Date()): Promise<TrafficOverview> {
  const today = statDay(now);
  const from30 = addDays(today, -29);
  const from7 = addDays(today, -6);
  const in30 = { date: { gte: from30, lte: today } };

  const [pvByDay, uvByDay, pages, sources, refs, devices, events, toolEvents, tools] = await Promise.all([
    prisma.pageViewDaily.groupBy({ by: ["date"], where: in30, _sum: { views: true } }),
    prisma.dailyVisitor.groupBy({ by: ["date"], where: in30, _count: { _all: true } }),
    prisma.pageViewDaily.groupBy({ by: ["path"], where: in30, _sum: { views: true }, orderBy: { _sum: { views: "desc" } }, take: 10 }),
    prisma.pageViewDaily.groupBy({ by: ["source", "date"], where: { ...in30, source: { not: "internal" } }, _sum: { views: true } }),
    prisma.pageViewDaily.groupBy({
      by: ["refDomain"],
      where: { ...in30, refDomain: { not: "" } },
      _sum: { views: true },
      orderBy: { _sum: { views: "desc" } },
      take: 8,
    }),
    prisma.pageViewDaily.groupBy({ by: ["device"], where: in30, _sum: { views: true } }),
    prisma.dailyMetric.groupBy({ by: ["eventType"], where: in30, _sum: { count: true } }),
    prisma.dailyMetric.groupBy({
      by: ["toolId", "eventType"],
      where: { ...in30, toolId: { not: null }, eventType: { in: ["tool_open", "tool_execute", "resource_to_tool_click"] } },
      _sum: { count: true },
    }),
    prisma.tool.findMany({ select: { id: true, name: true } }),
  ]);

  const pvMap = new Map(pvByDay.map((r) => [isoDay(r.date), n(r._sum.views)]));
  const uvMap = new Map(uvByDay.map((r) => [isoDay(r.date), n(r._count._all)]));
  const series: DayPoint[] = Array.from({ length: 30 }, (_, i) => {
    const d = isoDay(addDays(from30, i));
    return { date: d, pv: pvMap.get(d) ?? 0, uv: uvMap.get(d) ?? 0 };
  });
  const sumFrom = (start: Date) => {
    const s = isoDay(start);
    return series.filter((p) => p.date >= s).reduce((a, p) => ({ pv: a.pv + p.pv, uv: a.uv + p.uv }), { pv: 0, uv: 0 });
  };

  const srcTotals = new Map<string, number>();
  const search = { google7: 0, bing7: 0, google30: 0, bing30: 0 };
  for (const r of sources) {
    const v = n(r._sum.views);
    srcTotals.set(r.source, (srcTotals.get(r.source) ?? 0) + v);
    const recent = r.date >= from7;
    if (r.source === "google") {
      search.google30 += v;
      if (recent) search.google7 += v;
    } else if (r.source === "bing") {
      search.bing30 += v;
      if (recent) search.bing7 += v;
    }
  }

  const ev = Object.fromEntries(events.map((e) => [e.eventType, n(e._sum.count)]));
  const toolName = new Map(tools.map((t) => [t.id, t.name]));
  const perTool = new Map<string, { name: string; open: number; execute: number; click: number }>();
  for (const r of toolEvents) {
    if (!r.toolId) continue;
    const row = perTool.get(r.toolId) ?? { name: toolName.get(r.toolId) ?? "（已删除的工具）", open: 0, execute: 0, click: 0 };
    const v = n(r._sum.count);
    if (r.eventType === "tool_open") row.open += v;
    else if (r.eventType === "tool_execute") row.execute += v;
    else row.click += v;
    perTool.set(r.toolId, row);
  }

  return {
    today: isoDay(today),
    series,
    totals: { today: sumFrom(today), d7: sumFrom(from7), d30: sumFrom(from30) },
    topPages: pages.map((r) => ({ key: r.path, count: n(r._sum.views) })),
    sources: [...srcTotals.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count),
    referrers: refs.map((r) => ({ key: r.refDomain, count: n(r._sum.views) })),
    search,
    devices: devices.map((r) => ({ key: r.device, count: n(r._sum.views) })).sort((a, b) => b.count - a.count),
    events: {
      resource_view: ev.resource_view ?? 0,
      tool_open: ev.tool_open ?? 0,
      tool_execute: ev.tool_execute ?? 0,
      resource_to_tool_click: ev.resource_to_tool_click ?? 0,
    },
    tools: [...perTool.values()].sort((a, b) => b.open + b.execute + b.click - (a.open + a.execute + a.click)),
  };
}
