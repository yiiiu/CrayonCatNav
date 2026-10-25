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

/** 分类标签页的标签表单：在名称、slug 之外可编辑别名（逗号 / 顿号 / 换行分隔，每个 ≤20 字，最多 20 个，去重）。 */
export const tagFormSchema = tagInputSchema.extend({
  aliases: z
    .string()
    .default("")
    .transform((s) => {
      const out: string[] = [];
      for (const a of s.split(/[,，、\n]/).map((x) => x.trim()).filter(Boolean)) {
        if (!out.some((x) => x.toLowerCase() === a.toLowerCase())) out.push(a);
      }
      return out;
    })
    .pipe(z.array(z.string().max(20, "别名每个最多 20 字")).max(20, "别名最多 20 个")),
});
