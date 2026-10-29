import "server-only";
import type { ModelPurpose } from "@/generated/prisma/client";
import { prisma } from "./prisma";

/** 累加一次模型调用的用量（按北京时间自然日 × 用途）。 */
export async function addModelUsage(day: Date, purpose: ModelPurpose, promptTokens: number, completionTokens: number) {
  await prisma.modelUsageDaily.upsert({
    where: { day_purpose: { day, purpose } },
    create: { day, purpose, calls: 1, promptTokens, completionTokens },
    update: { calls: { increment: 1 }, promptTokens: { increment: promptTokens }, completionTokens: { increment: completionTokens } },
  });
}

/** [start, end) 区间内各用途的用量合计。 */
export async function sumModelUsage(start: Date, end: Date) {
  const rows = await prisma.modelUsageDaily.groupBy({
    by: ["purpose"],
    where: { day: { gte: start, lt: end } },
    _sum: { calls: true, promptTokens: true, completionTokens: true },
  });
  return rows.map((r) => ({
    purpose: r.purpose,
    calls: r._sum.calls ?? 0,
    promptTokens: r._sum.promptTokens ?? 0,
    completionTokens: r._sum.completionTokens ?? 0,
  }));
}
