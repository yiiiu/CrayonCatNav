import { z } from "zod";

/** slug：小写字母、数字与连字符，2–64 位 */
export const slugSchema = z
  .string()
  .trim()
  .min(2, "slug 至少 2 个字符")
  .max(64, "slug 最多 64 个字符")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug 只能包含小写字母、数字和连字符");

/** 外链协议白名单：仅 https */
export const httpsUrlSchema = z
  .string()
  .trim()
  .url("请输入合法链接")
  .refine((v) => v.startsWith("https://"), "外链仅允许 https");

export const optionalHttpsUrl = z.union([httpsUrlSchema, z.literal("").transform(() => undefined)]).optional();
