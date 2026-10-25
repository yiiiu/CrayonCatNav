import { z } from "zod";
import { isToolSlug } from "../tools/metas";
import { slugSchema } from "./common";
import { cleanHost, normalizePath } from "../analytics/traffic";

export const ALLOWED_EVENT_TYPES = [
  "resource_view",
  "tool_open",
  "tool_execute",
  "resource_to_tool_click",
] as const;

export type TrackEventType = (typeof ALLOWED_EVENT_TYPES)[number];

/** 业务事件（资源 / 工具）：按日计数到 DailyMetric */
export const eventPayloadSchema = z
  .object({
    eventType: z.enum(ALLOWED_EVENT_TYPES),
    toolId: z
      .string()
      .trim()
      .max(64)
      .optional()
      .refine((val) => !val || isToolSlug(val), {
        message: "toolId 必须在注册表内",
      }),
    resourceId: z
      .string()
      .trim()
      .max(64)
      .optional()
      .refine((val) => !val || slugSchema.safeParse(val).success, {
        message: "resourceId 必须是合法 slug",
      }),
  })
  .strict();

/**
 * 页面浏览：路径必须能归一化为公开页面路径；ref 只允许主机名（完整来源 URL 不出浏览器）。
 * 严格模式：任何额外字段（query、完整 URL、用户输入）都会被拒绝。
 */
export const pageViewPayloadSchema = z
  .object({
    eventType: z.literal("page_view"),
    path: z
      .string()
      .max(300)
      .refine((v) => normalizePath(v) !== null, { message: "path 必须是公开页面路径" }),
    ref: z
      .string()
      .max(253)
      .optional()
      .refine((v) => !v || cleanHost(v) !== "", { message: "ref 只能是主机名" }),
  })
  .strict();

export const trackPayloadSchema = z.union([eventPayloadSchema, pageViewPayloadSchema]);

export type EventPayload = z.infer<typeof eventPayloadSchema>;
export type PageViewPayload = z.infer<typeof pageViewPayloadSchema>;
export type TrackPayload = z.infer<typeof trackPayloadSchema>;
