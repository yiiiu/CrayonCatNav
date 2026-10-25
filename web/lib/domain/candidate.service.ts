import "server-only";
import { urlKeysOf } from "@/lib/agent/url";
import * as repo from "@/lib/data/agent.repo";
import { findBySlugAny } from "@/lib/data/resource.repo";
import { candidatePayloadSchema, candidateReviewSchema, type CandidatePayload } from "@/lib/validation/candidate";
import { resourceInputSchema } from "@/lib/validation/resource";
import { tagInputSchema } from "@/lib/validation/taxonomy";
import { tagSlugFor } from "@/prisma/tag-slugs";
import { DomainError } from "./result";

/**
 * 候选箱审核：直接上架 / 存为草稿 / 拒绝。
 * 上架与草稿都复用资源校验（resourceInputSchema），新标签按 prisma/tag-slugs.ts 规则生成 slug。
 */

export type TagPlan = { existingIds: string[]; newTags: { name: string; slug: string }[]; dropped: string[] };

/** 标签名 → 现有标签 id 或待新建标签；无法生成 slug 的中文标签：上架时报错，草稿时丢弃并提示。 */
export async function planTags(names: string[], strict: boolean): Promise<TagPlan> {
  const all = await repo.reviewLookups.allTags();
  const byName = new Map(all.map((t) => [t.name.toLowerCase(), t.id]));
  const bySlug = new Map(all.map((t) => [t.slug, t.id]));
  const plan: TagPlan = { existingIds: [], newTags: [], dropped: [] };
  for (const name of names) {
    const hit = byName.get(name.toLowerCase());
    if (hit) {
      plan.existingIds.push(hit);
      continue;
    }
    let slug: string;
    try {
      slug = tagSlugFor(name);
    } catch {
      if (strict) {
        throw new DomainError(`标签「${name}」没有对应的英文 slug：请改成已有标签或英文标签，或先在 prisma/tag-slugs.ts 补一条映射`, "tags");
      }
      plan.dropped.push(name);
      continue;
    }
    const checked = tagInputSchema.safeParse({ name, slug });
    if (!checked.success) {
      if (strict) throw new DomainError(`标签「${name}」不合法：${checked.error.issues[0]?.message ?? ""}`, "tags");
      plan.dropped.push(name);
      continue;
    }
    const sameSlug = bySlug.get(slug);
    if (sameSlug) plan.existingIds.push(sameSlug);
    else if (!plan.newTags.some((t) => t.slug === slug)) plan.newTags.push({ name, slug });
  }
  plan.existingIds = [...new Set(plan.existingIds)];
  return plan;
}

export type ConvertResult = { resourceId: string; slug: string; note?: string };

export async function convertCandidate(id: string, intent: "publish" | "draft", rawReview: unknown): Promise<ConvertResult> {
  const cand = await repo.findCandidate(id);
  if (!cand) throw new DomainError("候选不存在或已删除");
  if (cand.status !== "pending") throw new DomainError("这条候选已处理过了");
  const stored = candidatePayloadSchema.safeParse(cand.payload);
  if (!stored.success) throw new DomainError("候选数据格式异常，请拒绝后重新采集");

  const review = candidateReviewSchema.safeParse(rawReview);
  if (!review.success) {
    const issue = review.error.issues[0];
    throw new DomainError(issue?.message ?? "请检查填写内容", issue?.path.join(".") || undefined);
  }
  const payload: CandidatePayload = { ...stored.data, ...review.data };
  // 先把管理员的修改写回候选，失败后再打开也不丢
  await repo.updateCandidatePayload(id, payload, payload.name);

  const category = await repo.reviewLookups.categoryBySlug(payload.categorySlug);
  if (!category) throw new DomainError("分类不存在，请重新选择", "categorySlug");

  const strict = intent === "publish";
  const tags = await planTags(payload.tags, strict);
  const tools = await repo.reviewLookups.toolsBySlugs(payload.toolSlugs);

  // 复用资源校验：新标签先用占位 id 参与「至少一个标签」与数量检查
  const status = intent === "publish" ? "published" : "draft";
  const check = resourceInputSchema.safeParse({
    slug: payload.slug,
    name: payload.name,
    summary: payload.summary,
    description: payload.description,
    categoryId: category.id,
    websiteUrl: payload.websiteUrl ?? "",
    githubUrl: payload.githubUrl ?? "",
    iconUrl: "",
    pricingType: payload.pricingType,
    status,
    tagIds: [...tags.existingIds, ...tags.newTags.map((t) => `new:${t.slug}`)],
    toolIds: tools.map((t) => t.id),
  });
  if (!check.success) {
    const issue = check.error.issues[0];
    const field = issue?.path[0] === "tagIds" ? "tags" : String(issue?.path[0] ?? "");
    throw new DomainError(issue?.message ?? "信息不完整", ["name", "slug", "summary", "tags"].includes(field) ? field : undefined);
  }
  if (await findBySlugAny(check.data.slug)) throw new DomainError("这个 slug 已被其他资源使用，请改一个", "slug");

  // 候选入库后可能有人手动录入了同一资源
  const keys = new Set(urlKeysOf(payload.websiteUrl, payload.githubUrl));
  const resources = await repo.reviewLookups.resourceUrls();
  const clash = resources.find((r) => urlKeysOf(r.websiteUrl, r.githubUrl).some((k) => keys.has(k)));
  if (clash) throw new DomainError(`资源库里已有相同链接的「${clash.name}」，建议拒绝这条候选`);

  const created = await repo.convertCandidateTx({
    candidateId: id,
    status: intent === "publish" ? "published" : "drafted",
    newTags: tags.newTags,
    existingTagIds: tags.existingIds,
    toolIds: check.data.toolIds,
    resource: {
      slug: check.data.slug,
      name: check.data.name,
      summary: check.data.summary,
      description: check.data.description,
      categoryId: check.data.categoryId,
      websiteUrl: check.data.websiteUrl ?? null,
      githubUrl: check.data.githubUrl ?? null,
      pricingType: check.data.pricingType,
      status,
    },
  });
  if (!created) throw new DomainError("这条候选已处理过了");
  return {
    resourceId: created.id,
    slug: created.slug,
    note: tags.dropped.length ? `以下标签没有英文 slug，未添加：${tags.dropped.join("、")}` : undefined,
  };
}

export async function rejectCandidate(id: string) {
  const { count } = await repo.rejectCandidate(id);
  if (count !== 1) throw new DomainError("这条候选不存在或已处理过了");
}
