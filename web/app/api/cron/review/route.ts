import { revalidateTag } from "next/cache";
import { connection, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/agent/cron-auth";
import { isSlotActive, parseSlot } from "@/lib/agent/cron-schedule";
import { getSetting } from "@/lib/data/agent.repo";
import { cacheTags } from "@/lib/cache/tags";
import { batchMessage, reviewPending } from "@/lib/domain/review.service";
import { DomainError } from "@/lib/domain/result";

/** 定时审核（vercel.json 4 个时段，各排在同时段采集 1 小时后；后台「每天次数」决定启用哪些）。规格 docs/spec/审核Agent方案.md。 */
export const maxDuration = 300;

export async function GET(request: Request) {
  return handle(request, new URL(request.url).searchParams.get("slot"));
}

/** 也供 /api/cron/review/[slot] 使用（vercel.json 走路径段，避免依赖查询参数）。 */
export async function handle(request: Request, slotParam: string | null) {
  await connection();
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "unconfigured") return NextResponse.json({ ok: false, error: "未配置 CRON_SECRET，定时审核已禁用" }, { status: 503 });
  if (auth === "denied") return NextResponse.json({ ok: false, error: "未授权" }, { status: 401 });
  const slot = parseSlot(slotParam);
  if (!slot) return NextResponse.json({ ok: false, error: "slot 无效" }, { status: 400 });
  const times = (await getSetting()).cronTimesPerDay;
  if (!isSlotActive(times, slot)) return NextResponse.json({ ok: true, skipped: true, message: `时段 ${slot} 未启用（每天 ${times} 次）` });
  try {
    const r = await reviewPending("cron");
    if (r.slugs.length) {
      revalidateTag(cacheTags.resources, "max");
      revalidateTag(cacheTags.home, "max");
      revalidateTag(cacheTags.taxonomy, "max");
      for (const s of r.slugs) revalidateTag(cacheTags.resource(s), "max");
    }
    return NextResponse.json({
      ok: true,
      reviewed: r.reviewed,
      published: r.published,
      drafted: r.drafted,
      rejected: r.rejected,
      human: r.human,
      failed: r.failed,
      remaining: r.remaining,
      message: batchMessage(r),
    });
  } catch (e) {
    if (e instanceof DomainError) return NextResponse.json({ ok: false, error: e.message }, { status: 409 });
    return NextResponse.json({ ok: false, error: "审核失败" }, { status: 500 });
  }
}
