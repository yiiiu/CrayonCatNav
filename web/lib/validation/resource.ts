import { z } from "zod";
import { httpsUrlSchema, optionalHttpsUrl, slugSchema } from "./common";

export const resourceInputSchema = z.object({
  slug: slugSchema,
  name: z.string().trim().min(1, "请填写名称").max(80),
  summary: z.string().trim().min(1, "请填写简介").max(200),
  description: z.string().max(20000).default(""),
  categoryId: z.string().min(1, "请选择分类"),
  websiteUrl: httpsUrlSchema,
  githubUrl: optionalHttpsUrl,
  iconUrl: optionalHttpsUrl,
  pricingType: z.enum(["unknown", "free", "freemium", "paid"]).default("unknown"),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  tagIds: z.array(z.string()).default([]),
});

export type ResourceInput = z.infer<typeof resourceInputSchema>;
