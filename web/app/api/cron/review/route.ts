import { revalidateTag } from "next/cache";
import { connection, NextResponse } from "next/server";
import { checkCronAuth } from "@/lib/agent/cron-auth";
import { cacheTags } from "@/lib/cache/tags";
import { batchMessage, reviewPending } from "@/lib/domain/review.service";
import { DomainError } from "@/lib/domain/result";

/** 每日定时审核（vercel.json crons，北京时间 10:00，排在采集之后）。规格 docs/spec/审核Agent方案.md。 */
export const maxDuration = 300;

export async function GET(request: Request) {
  await connection();
  const auth = checkCronAuth(request.headers.get("authorization"), process.env.CRON_SECRET);
  if (auth === "unconfigured") return NextResponse.json({ ok: false, error: "未配置 CRON_SECRET，定时审核已禁用" }, { status: 503 });
  if (auth === "denied") return NextResponse.json({ ok: false, error: "未授权" }, { status: 401 });
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
