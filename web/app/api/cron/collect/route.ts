import { connection, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/agent/cron-auth";
import { getSetting } from "@/lib/data/agent.repo";
import { runCollection } from "@/lib/domain/collector.service";
import { DomainError } from "@/lib/domain/result";

/** 每日定时采集（vercel.json crons）。最长运行 300 秒；结果只返回计数，不含任何密钥。 */
export const maxDuration = 300;

/**
 * 不是后台 action，不走 requireAdmin：改用 CRON_SECRET 保护。
 * 未配置 CRON_SECRET 时返回 503 并拒绝执行。
 */
export async function GET(request: Request) {
  await connection(); // 明确为请求时执行，绝不在构建期预渲染
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "unconfigured") return NextResponse.json({ ok: false, error: "未配置 CRON_SECRET，定时采集已禁用" }, { status: 503 });
  if (auth === "denied") return NextResponse.json({ ok: false, error: "未授权" }, { status: 401 });
  // 后台关掉了定时采集：正常返回 200，Vercel 不会当成失败重试
  if (!(await getSetting()).cronEnabled) return NextResponse.json({ ok: true, skipped: true, message: "定时采集已在后台关闭" });
  try {
    const r = await runCollection("cron");
    return NextResponse.json({ ok: r.status === "succeeded", runId: r.runId, found: r.found, created: r.created, skipped: r.skipped, failed: r.failed, message: r.message });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: "采集失败" }, { status: 500 });
  }
}
