import { type NextRequest, NextResponse } from "next/server";
import { suggestPublished } from "@/lib/data/resource.repo";
import { normalizeQuery } from "@/lib/ui/live-search";

/**
 * 前台搜索框实时联想：只返回已发布资源的前 6 条（名称 / 简介 / 分类）。
 * 查询走与列表页相同的条件与缓存；关键词最长 50 字，空关键词直接返回空结果。
 */
export async function GET(req: NextRequest) {
  const q = normalizeQuery(req.nextUrl.searchParams.get("q"));
  if (!q) return NextResponse.json({ q, total: 0, items: [] });
  try {
    const { total, items } = await suggestPublished(q);
    return NextResponse.json({ q, total, items }, { headers: { "Cache-Control": "public, max-age=30, s-maxage=60" } });
  } catch {
    return NextResponse.json({ q, total: 0, items: [], error: true }, { status: 500 });
  }
}
