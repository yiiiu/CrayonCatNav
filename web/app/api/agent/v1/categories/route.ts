import { listCategories } from "@/lib/domain/agent-api.service";
import { preflight, serve } from "@/lib/agent-api/http";

/** GET /api/agent/v1/categories：有已发布资源的分类及数量。 */
export function GET(req: Request) {
  return serve(req, "list_categories", () => listCategories());
}
export const OPTIONS = preflight;
