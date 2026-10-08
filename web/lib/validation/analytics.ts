import { z } from "zod";
import { isToolSlug } from "../tools/metas";
import { slugSchema } from "./common";

export const ALLOWED_EVENT_TYPES = [
  "resource_view",
  "tool_open",
  "tool_execute",
  "resource_to_tool_click",
] as const;

export type TrackEventType = (typeof ALLOWED_EVENT_TYPES)[number];

export const trackPayloadSchema = z
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

export type TrackPayload = z.infer<typeof trackPayloadSchema>;
