import { z } from "zod";
import { slugSchema } from "./common";

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1, "请填写分类名").max(20, "分类名最多 20 字"),
  slug: slugSchema,
  sortOrder: z.coerce.number().int().min(0).max(999).default(0),
});

export const tagInputSchema = z.object({
  name: z.string().trim().min(1, "请填写标签名").max(20, "标签名最多 20 字"),
  slug: slugSchema,
});
