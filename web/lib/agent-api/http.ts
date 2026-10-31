import "server-only";
import { NextResponse } from "next/server";
import { clientIp } from "@/lib/analytics/visitor";
import { guard, track, type AgentResult, type AgentTool } from "@/lib/domain/agent-api.service";
import { UNKNOWN_IP } from "@/lib/security/rate-limit";

/**
 * Agent HTTP API 的公共外壳（规格 docs/spec/Agent接入方案.md §4）：
 * 开放 CORS（只读、无 cookie）→ IP 限流 → 调核心服务 → 统一 JSON 格式与状态码。
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

export function preflight() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function serve<T>(req: Request, tool: AgentTool, run: () => Promise<AgentResult<T>>) {
  const limit = await guard(clientIp(req.headers) || UNKNOWN_IP);
  if (!limit.ok)
    return NextResponse.json(
      { ok: false, code: "rate_limited", message: `请求太频繁，请 ${limit.retryAfterSec} 秒后再试` },
      { status: 429, headers: { ...CORS_HEADERS, "Retry-After": String(limit.retryAfterSec), "Cache-Control": "no-store" } },
    );
  try {
    const r = await run();
    track("http", tool);
    if (!r.ok) return NextResponse.json(r, { status: r.code === "not_found" ? 404 : 400, headers: { ...CORS_HEADERS, "Cache-Control": "no-store" } });
    return NextResponse.json({ ok: true, ...r.data }, { headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json({ ok: false, code: "error", message: "服务出错了，请稍后再试" }, { status: 500, headers: CORS_HEADERS });
  }
}
