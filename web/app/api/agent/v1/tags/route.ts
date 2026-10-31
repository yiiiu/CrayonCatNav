import { type NextRequest } from "next/server";
import { listTags } from "@/lib/domain/agent-api.service";
import { preflight, serve } from "@/lib/agent-api/http";

/** GET /api/agent/v1/tags?category=：常用标签（可限定分类），按使用量排序。 */
export function GET(req: NextRequest) {
  return serve(req, "list_tags", () => listTags({ category: req.nextUrl.searchParams.get("category")?.trim() || undefined }));
}
export const OPTIONS = preflight;
