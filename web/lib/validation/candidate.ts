import { z } from "zod";
import { canonicalGithubUrl, isHttpsUrl, normalizeUrl } from "@/lib/agent/url";
import type { RawCandidate } from "@/lib/agent/types";
import { pricingTypes } from "./resource";
import { suggestSlug } from "./search";
import { cleanTagOutput, parseTagInput, type SuggestedTag, type TagEntry, type TagVocab } from "./tag-vocab";

/** 模型的结构化输出（宽松接收，随后清洗）。skip=true 表示模型判断不值得收录。 */
export const modelSkipSchema = z.object({ skip: z.literal(true), reason: z.string().trim().max(500).default("") });

export const modelOutputSchema = z.object({
    skip: z.literal(false).optional(),
    name: z.string().trim().min(1, "name 不能为空").max(80, "name 最多 80 字"),
    slug: z.string().trim().max(80).optional().default(""),
    summary: z
      .string()
      .trim()
      .min(1, "summary 不能为空")
      .max(200, "summary 最多 200 字")
      .refine((s) => /[\u4e00-\u9fff]/.test(s), "summary 必须是中文"),
    description: z.string().trim().max(4000, "description 最多 4000 字").default(""),
    categorySlug: z.string().trim().min(1, "必须选择 categorySlug"),
    tags: z.array(z.string()).max(20).default([]),
    suggestedTags: z.array(z.unknown()).max(10).default([]),
    websiteUrl: z.string().nullish(),
    githubUrl: z.string().nullish(),
    pricingType: z.string().nullish(),
    toolSlugs: z.array(z.string()).default([]),
    reason: z.string().trim().min(1, "reason 不能为空").max(500),
    confidence: z.coerce.number().min(0, "confidence 需在 0–1").max(1, "confidence 需在 0–1"),
  });

/** 存库的候选结构（payload 列），也是候选箱编辑表单的数据。 */
export const candidatePayloadSchema = z.object({
  name: z.string(),
  slug: z.string(),
  summary: z.string(),
  description: z.string(),
  categorySlug: z.string(),
  tags: z.array(z.string()),
  /** 模型建议的新标签（进待定池）；旧候选没有这一项 */
  suggestedTags: z.array(z.object({ name: z.string(), slug: z.string() })).default([]),
  websiteUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  pricingType: z.enum(pricingTypes),
  toolSlugs: z.array(z.string()),
});
export type CandidatePayload = z.infer<typeof candidatePayloadSchema>;

export type CleanContext = {
  categorySlugs: readonly string[];
  /** 标签受控词表（现有标签名称、别名、slug 与已忽略的建议词） */
  tags: TagVocab;
  toolSlugs: readonly string[];
};

export type CleanResult =
  | { ok: true; skip: false; payload: CandidatePayload; reason: string; confidence: number }
  | { ok: true; skip: true; reason: string }
  | { ok: false; error: string };

/** 从模型回复里取出 JSON（容忍 ```json 代码块包裹）。 */
export function extractJson(text: string): unknown {
  const t = text.trim();
  const fenced = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const body = fenced ? fenced[1] : t;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(body.slice(start, end + 1));
    throw new Error("模型回复不是合法 JSON");
  }
}

function slugFrom(model: string, name: string, github: string | null, website: string | null): string {
  for (const cand of [model, name, github?.split("/").pop() ?? "", website ? new URL(website).hostname.replace(/^www\./, "").split(".")[0] : ""]) {
    const s = suggestSlug(cand).slice(0, 64).replace(/-+$/, "");
    if (s.length >= 2) return s;
  }
  return "";
}

/**
 * 校验并清洗模型输出。不编造链接：官网 / GitHub 只能取自来源数据（模型只可选择保留或去掉），
 * 分类只能是现有分类，工具只能是注册表内的，定价未知时为 unknown。
 */
export function cleanModelOutput(json: unknown, raw: Pick<RawCandidate, "websiteUrl" | "githubUrl">, ctx: CleanContext): CleanResult {
  const skip = modelSkipSchema.safeParse(json);
  if (skip.success) return { ok: true, skip: true, reason: skip.data.reason };
  const parsed = modelOutputSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `${issue?.path.join(".") || "输出"}：${issue?.message ?? "格式不对"}` };
  }
  const v = parsed.data;
  if (!ctx.categorySlugs.includes(v.categorySlug)) {
    return { ok: false, error: `categorySlug 只能从 ${ctx.categorySlugs.join(" / ")} 中选择` };
  }
  const rawGithub = raw.githubUrl ? canonicalGithubUrl(raw.githubUrl) : null;
  const rawWebsite = isHttpsUrl(raw.websiteUrl) ? raw.websiteUrl : null;
  // 模型显式给 null 表示该链接不是产品本身（例如官网字段其实是文档站），允许去掉；给出的其他链接一律忽略
  const githubUrl = v.githubUrl === null ? null : rawGithub;
  let websiteUrl = v.websiteUrl === null ? null : rawWebsite;
  if (websiteUrl && githubUrl && normalizeUrl(websiteUrl) === normalizeUrl(githubUrl)) websiteUrl = null;
  if (!githubUrl && !websiteUrl) return { ok: false, error: "至少保留来源提供的官网或 GitHub 链接之一" };
  const slug = slugFrom(v.slug, v.name, githubUrl, websiteUrl);
  if (!slug) return { ok: false, error: "slug 需为小写英文、数字和连字符" };
  const pricing = (pricingTypes as readonly string[]).includes(v.pricingType ?? "") ? (v.pricingType as CandidatePayload["pricingType"]) : "unknown";
  return {
    ok: true,
    skip: false,
    reason: v.reason,
    confidence: Math.round(v.confidence * 100) / 100,
    payload: {
      name: v.name,
      slug,
      summary: v.summary,
      description: v.description,
      categorySlug: v.categorySlug,
      ...cleanTagOutput(v.tags, v.suggestedTags, ctx.tags),
      websiteUrl,
      githubUrl,
      pricingType: pricing,
      toolSlugs: [...new Set(v.toolSlugs.filter((t) => ctx.toolSlugs.includes(t)))],
    },
  };
}

/* ---------- 候选箱审核表单 ---------- */

/** 审核时管理员可改的字段；tags 用逗号（中英文）或换行分隔，新标签写成「名字:slug」。 */
export const candidateReviewSchema = z.object({
  name: z.string().trim().min(1, "请填写名称").max(80, "名称最多 80 字"),
  slug: z.string().trim(),
  summary: z.string().trim().min(1, "请填写简介").max(200, "简介最多 200 字"),
  categorySlug: z.string().trim().min(1, "请选择分类"),
  tags: z
    .string()
    .default("")
    .transform((s): TagEntry[] => parseTagInput(s)),
});
export type CandidateReview = z.infer<typeof candidateReviewSchema>;

/** 审核条目 → payload 的 tags / suggestedTags（带 slug 的算新标签）。 */
export function splitTagEntries(entries: readonly TagEntry[]): { tags: string[]; suggestedTags: SuggestedTag[] } {
  return {
    tags: entries.filter((e) => !e.slug).map((e) => e.name),
    suggestedTags: entries.filter((e): e is SuggestedTag => !!e.slug),
  };
}

export function candidateReviewFromForm(fd: FormData) {
  const str = (k: string) => (fd.get(k) ?? "").toString();
  return { name: str("name"), slug: str("slug"), summary: str("summary"), categorySlug: str("categorySlug"), tags: str("tags") };
}
