import { CORS_HEADERS } from "@/lib/agent-api/http";
import { openApiDocument } from "@/lib/agent-api/openapi";
import { siteConfig } from "@/lib/site";

/** GET /api/agent/v1/openapi.json：Agent HTTP API 的 OpenAPI 3.1 描述。 */
export function GET() {
  return Response.json(openApiDocument(siteConfig.url.replace(/\/$/, "")), {
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=3600" },
  });
}
