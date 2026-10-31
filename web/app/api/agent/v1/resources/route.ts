import { type NextRequest } from "next/server";
import { searchResources } from "@/lib/domain/agent-api.service";
import { searchParamsToInput } from "@/lib/agent-api/core";
import { preflight, serve } from "@/lib/agent-api/http";

/** GET /api/agent/v1/resources?q=&category=&tag=&pricing=&limit=&cursor=：筛选已发布资源。 */
export function GET(req: NextRequest) {
  return serve(req, "search_resources", () => searchResources(searchParamsToInput(req.nextUrl.searchParams)));
}
export const OPTIONS = preflight;
