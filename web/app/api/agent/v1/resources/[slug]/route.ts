import { getResource } from "@/lib/domain/agent-api.service";
import { preflight, serve } from "@/lib/agent-api/http";

/** GET /api/agent/v1/resources/{slug}：资源详情 + 快速上手 + 站内配套工具。 */
export async function GET(req: Request, ctx: RouteContext<"/api/agent/v1/resources/[slug]">) {
  const { slug } = await ctx.params;
  return serve(req, "get_resource", () => getResource({ slug }));
}
export const OPTIONS = preflight;
