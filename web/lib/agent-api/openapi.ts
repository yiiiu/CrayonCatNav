import { PRICING, QUERY_MAX, SEARCH_LIMIT_DEFAULT, SEARCH_LIMIT_MAX, TAGS_MAX } from "./core";

/** Agent HTTP API 的 OpenAPI 3.1 描述（手写，与 core.ts 的校验保持一致；改参数时同步）。 */
export function openApiDocument(origin: string) {
  const slug = { type: "string", pattern: "^[a-z0-9][a-z0-9-]{0,79}$" };
  const err = (description: string) => ({ description, content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } });
  const errors = { "400": err("参数不合法"), "429": { ...err("请求太频繁"), headers: { "Retry-After": { schema: { type: "integer" } } } }, "500": err("服务出错") };
  const nullableStr = { type: ["string", "null"] };
  return {
    openapi: "3.1.0",
    info: {
      title: "蜡笔猫导航 Agent API",
      version: "1.0.0",
      description: "只读查询蜡笔猫导航收录的 AI 资源。匿名访问，按 IP 限流（每分钟 60 次、每天 2000 次）。文档：" + `${origin}/docs/api`,
    },
    servers: [{ url: `${origin}/api/agent/v1` }],
    paths: {
      "/categories": {
        get: {
          operationId: "listCategories",
          summary: "列出分类",
          responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/CategoryList" } } } }, ...errors },
        },
      },
      "/tags": {
        get: {
          operationId: "listTags",
          summary: "列出常用标签",
          parameters: [{ name: "category", in: "query", schema: slug }],
          responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/TagList" } } } }, ...errors },
        },
      },
      "/resources": {
        get: {
          operationId: "searchResources",
          summary: "筛选资源",
          parameters: [
            { name: "q", in: "query", description: "关键词或需求描述", schema: { type: "string", maxLength: QUERY_MAX } },
            { name: "category", in: "query", schema: slug },
            { name: "tag", in: "query", description: `标签 slug，可重复，最多 ${TAGS_MAX} 个`, schema: { type: "array", items: slug, maxItems: TAGS_MAX }, style: "form", explode: true },
            { name: "pricing", in: "query", schema: { type: "string", enum: [...PRICING] } },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: SEARCH_LIMIT_MAX, default: SEARCH_LIMIT_DEFAULT } },
            { name: "cursor", in: "query", description: "上一页的 nextCursor", schema: { type: "string" } },
          ],
          responses: { "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ResourceList" } } } }, ...errors },
        },
      },
      "/resources/{slug}": {
        get: {
          operationId: "getResource",
          summary: "资源详情",
          parameters: [{ name: "slug", in: "path", required: true, schema: slug }],
          responses: {
            "200": { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/ResourceDetail" } } } },
            "404": err("资源不存在或未发布"),
            ...errors,
          },
        },
      },
    },
    components: {
      schemas: {
        Error: {
          type: "object",
          required: ["ok", "code", "message"],
          properties: { ok: { const: false }, code: { type: "string", enum: ["invalid_input", "not_found", "rate_limited", "error"] }, message: { type: "string" } },
        },
        CategoryList: {
          type: "object",
          properties: {
            ok: { const: true },
            categories: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" }, count: { type: "integer" } } } },
          },
        },
        TagList: {
          type: "object",
          properties: {
            ok: { const: true },
            category: nullableStr,
            tags: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" }, count: { type: "integer" } } } },
          },
        },
        ResourceItem: {
          type: "object",
          properties: {
            slug: { type: "string" },
            name: { type: "string" },
            summary: { type: "string" },
            category: { type: "string" },
            tags: { type: "array", items: { type: "string" } },
            pricing: { type: ["string", "null"], enum: [...PRICING, null] },
            websiteUrl: nullableStr,
            githubUrl: nullableStr,
            url: { type: "string" },
          },
        },
        ResourceList: {
          type: "object",
          properties: { ok: { const: true }, total: { type: "integer" }, nextCursor: nullableStr, items: { type: "array", items: { $ref: "#/components/schemas/ResourceItem" } } },
        },
        ResourceDetail: {
          type: "object",
          properties: {
            ok: { const: true },
            slug: { type: "string" },
            name: { type: "string" },
            summary: { type: "string" },
            description: { type: "string" },
            category: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" } } },
            tags: { type: "array", items: { type: "object", properties: { slug: { type: "string" }, name: { type: "string" } } } },
            pricing: { type: ["string", "null"], enum: [...PRICING, null] },
            pricingNote: nullableStr,
            websiteUrl: nullableStr,
            githubUrl: nullableStr,
            url: { type: "string" },
            highlights: { type: "array", items: { type: "string" } },
            useCases: { type: "array", items: { type: "string" } },
            platforms: { type: "array", items: { type: "string" } },
            quickstart: nullableStr,
            siteTools: { type: "array", items: { type: "object", properties: { name: { type: "string" }, url: { type: "string" } } } },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
      },
    },
  };
}
