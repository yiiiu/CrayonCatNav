import { type NextRequest, NextResponse } from "next/server";
import { classifySource, deviceOf, isBotUA, normalizePath, statDay } from "@/lib/analytics/traffic";
import { clientIp, visitorHash } from "@/lib/analytics/visitor";
import { dailySalt, recordEvent, recordPageView, recordVisitor } from "@/lib/data/analytics.repo";
import { trackPayloadSchema } from "@/lib/validation/analytics";

/**
 * 匿名埋点入口：无 Cookie、不存 IP / UA / 完整来源 URL。
 * - 业务事件（resource_view / tool_* / resource_to_tool_click）→ DailyMetric 按日计数；
 * - page_view → PageViewDaily 按日聚合 + DailyVisitor 当日去重哈希。
 * 机器人 UA 与后台 / 接口路径一律忽略。统计日按北京时间。
 */
export async function POST(req: NextRequest) {
  try {
    const parsed = trackPayloadSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }
    const ua = req.headers.get("user-agent") ?? "";
    if (isBotUA(ua)) return new NextResponse(null, { status: 204 });

    const day = statDay();
    const p = parsed.data;

    if (p.eventType === "page_view") {
      const path = normalizePath(p.path);
      if (!path) return new NextResponse(null, { status: 204 });
      const { source, refDomain } = classifySource(p.ref ?? "", req.nextUrl.hostname);
      await recordPageView(day, { path, source, refDomain, device: deviceOf(ua) });
      const salt = await dailySalt(day);
      await recordVisitor(day, visitorHash(salt, clientIp(req.headers), ua));
    } else {
      await recordEvent(day, p.eventType, p.toolId, p.resourceId);
    }
    return NextResponse.json({ ok: true });
  } catch {
    // 埋点异常静默，返回 200 保证客户端主流程不被打断；不记录请求内容
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
