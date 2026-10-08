import { z } from "zod";
import { optionalHttpsUrl, slugSchema } from "./common";

export const pricingTypes = ["unknown", "free", "freemium", "paid"] as const;
export const resourceStatuses = ["draft", "published", "archived"] as const;

export const pricingLabels: Record<(typeof pricingTypes)[number], string> = {
  unknown: "未知",
  free: "免费",
  freemium: "免费增值",
  paid: "付费",
};

export const statusLabels: Record<(typeof resourceStatuses)[number], string> = {
  draft: "草稿",
  published: "已发布",
  archived: "已下架",
};

export const resourceInputSchema = z
  .object({
    slug: slugSchema,
    name: z.string().trim().min(1, "请填写名称").max(80, "名称最多 80 字"),
    summary: z.string().trim().min(1, "请填写简介").max(200, "简介最多 200 字"),
    description: z.string().trim().max(20000, "描述过长").default(""),
    categoryId: z.string().min(1, "请选择分类"),
    websiteUrl: optionalHttpsUrl,
    githubUrl: optionalHttpsUrl,
    iconUrl: optionalHttpsUrl,
    pricingType: z.enum(pricingTypes).default("unknown"),
    status: z.enum(resourceStatuses).default("draft"),
    tagIds: z.array(z.string().min(1)).max(12, "标签最多 12 个").default([]),
    toolIds: z.array(z.string().min(1)).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.githubUrl && !/^https:\/\/github\.com\/[^/]+\/[^/]+/.test(v.githubUrl)) {
      ctx.addIssue({ code: "custom", path: ["githubUrl"], message: "请填写 https://github.com/所有者/仓库 形式的链接" });
    }
    if (v.status === "published") {
      if (!v.websiteUrl && !v.githubUrl) {
        ctx.addIssue({ code: "custom", path: ["websiteUrl"], message: "发布前至少填写官网或 GitHub 链接" });
      }
      if (v.tagIds.length === 0) {
        ctx.addIssue({ code: "custom", path: ["tagIds"], message: "发布前至少选择一个标签" });
      }
    }
  });

export type ResourceInput = z.infer<typeof resourceInputSchema>;

/** 从表单读取原始值（多选字段用 getAll）。 */
export function resourceFormToObject(fd: FormData) {
  const str = (k: string) => (fd.get(k) ?? "").toString();
  return {
    slug: str("slug"),
    name: str("name"),
    summary: str("summary"),
    description: str("description"),
    categoryId: str("categoryId"),
    websiteUrl: str("websiteUrl"),
    githubUrl: str("githubUrl"),
    iconUrl: str("iconUrl"),
    pricingType: str("pricingType") || "unknown",
    status: str("status") || "draft",
    tagIds: fd.getAll("tagIds").map(String),
    toolIds: fd.getAll("toolIds").map(String),
  };
}
