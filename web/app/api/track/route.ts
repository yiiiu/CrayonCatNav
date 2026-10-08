import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/data/prisma";
import { trackPayloadSchema } from "@/lib/validation/analytics";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = trackPayloadSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
    }

    const { eventType, toolId: toolSlug, resourceId: resourceSlug } = parsed.data;

    let toolDbId: string | null = null;
    if (toolSlug) {
      const tool = await prisma.tool.findUnique({
        where: { slug: toolSlug },
        select: { id: true },
      });
      toolDbId = tool?.id ?? null;
    }

    let resourceDbId: string | null = null;
    if (resourceSlug) {
      const res = await prisma.resource.findUnique({
        where: { slug: resourceSlug },
        select: { id: true },
      });
      resourceDbId = res?.id ?? null;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const existing = await prisma.dailyMetric.findFirst({
      where: {
        date: today,
        eventType,
        resourceId: resourceDbId,
        toolId: toolDbId,
      },
    });

    if (existing) {
      await prisma.dailyMetric.update({
        where: { id: existing.id },
        data: { count: { increment: 1 } },
      });
    } else {
      await prisma.dailyMetric.create({
        data: {
          date: today,
          eventType,
          resourceId: resourceDbId,
          toolId: toolDbId,
          count: 1,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch {
    // 埋点异常静默，返回 200 保证客户端主流程不被打断
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
