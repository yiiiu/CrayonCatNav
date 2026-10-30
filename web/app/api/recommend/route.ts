import { type NextRequest, NextResponse } from "next/server";
import { clientIp } from "@/lib/analytics/visitor";
import { recommend } from "@/lib/domain/recommend.service";
import { UNKNOWN_IP } from "@/lib/security/rate-limit";

/**
 * 前台推荐 Agent 接口（规格 docs/spec/前台推荐Agent方案.md §4）。
 * 用 POST：访客输入不进 URL / 访问日志；只接受同源请求，防止被当成免费模型代理。
 * 出错时只返回通用提示，不记录请求内容。
 */
export const maxDuration = 30;

function sameOrigin(req: NextRequest): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin";
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (req.headers.get("x-forwarded-host") ?? req.headers.get("host"));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return NextResponse.json({ ok: false, code: "forbidden", message: "不支持跨站调用" }, { status: 403 });
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: "invalid_input", message: "请求格式不对" }, { status: 400 });
  }
  try {
    const b = body as { q?: unknown; context?: unknown } | null;
    const r = await recommend(b?.q, clientIp(req.headers) || UNKNOWN_IP, b?.context);
    const status = r.ok ? 200 : r.code === "rate_limited" ? 429 : r.code === "disabled" ? 503 : 400;
    const headers: Record<string, string> = { "Cache-Control": "no-store" };
    if (!r.ok && r.retryAfterSec) headers["Retry-After"] = String(r.retryAfterSec);
    return NextResponse.json(r, { status, headers });
  } catch {
    return NextResponse.json({ ok: false, code: "error", message: "推荐服务出错了，请稍后再试" }, { status: 500 });
  }
}
