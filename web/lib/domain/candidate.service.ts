import "server-only";
import { urlKeysOf } from "@/lib/agent/url";
import * as repo from "@/lib/data/agent.repo";
import { findBySlugAny } from "@/lib/data/resource.repo";
import { candidatePayloadSchema, candidateReviewSchema, splitTagEntries, type CandidatePayload } from "@/lib/validation/candidate";
import { resourceInputSchema } from "@/lib/validation/resource";
import type { TagEntry } from "@/lib/validation/tag-vocab";
import { tagInputSchema } from "@/lib/validation/taxonomy";
import { tagSlugFor } from "@/prisma/tag-slugs";
import { DomainError } from "./result";

/**
 * 候选箱审核：直接上架 / 存为草稿 / 拒绝。
 * 上架与草稿都复用资源校验（resourceInputSchema）；新标签写成「名字:slug」，规则见 docs/plan/标签治理方案.md。
 */

export type TagPlan = { existingIds: string[]; newTags: { name: string; slug: string }[]; dropped: string[] };

/**
 * 审核条目 → 现有标签 id 或待新建标签。查找顺序：现有标签同名 → 别名 → 条目自带 slug → tag-slugs.ts 映射 → 纯英文名按规则转换。
 * 无法得到 slug，或 slug 已被另一名称的标签占用：上架（strict）时报错，存草稿时丢弃并提示。绝不静默并入别的标签。
 */
export async function planTags(entries: readonly TagEntry[], strict: boolean): Promise<TagPlan> {
  const all = await repo.reviewLookups.allTags();
  const byName = new Map<string, string>();
  for (const t of all) byName.set(t.name.toLowerCase(), t.id);
  for (const t of all) for (const a of t.aliases) if (!byName.has(a.toLowerCase())) byName.set(a.toLowerCase(), t.id);
  const bySlug = new Map(all.map((t) => [t.slug, t]));
  const plan: TagPlan = { existingIds: [], newTags: [], dropped: [] };
  const fail = (name: string, msg: string) => {
    if (strict) throw new DomainError(msg, "tags");
    plan.dropped.push(name);
  };
  for (const { name, slug: given } of entries) {
    const hit = byName.get(name.toLowerCase());
    if (hit) {
      plan.existingIds.push(hit);
      continue;
    }
    let slug: string;
    try {
      slug = given ?? tagSlugFor(name);
    } catch {
      fail(name, `新标签「${name}」需要英文 slug：请写成「${name}:英文-slug」（如 视频剪辑:video-editing），或改用已有标签`);
      continue;
    }
    const checked = tagInputSchema.safeParse({ name, slug });
    if (!checked.success) {
      fail(name, `标签「${name}」不合法：${checked.error.issues[0]?.message ?? ""}`);
      continue;
    }
    const owner = bySlug.get(slug);
    if (owner) {
      fail(name, `slug「${slug}」已被标签「${owner.name}」使用：同一个意思请直接写「${owner.name}」，否则换一个 slug`);
      continue;
    }
    if (!plan.newTags.some((t) => t.slug === slug)) plan.newTags.push({ name, slug });
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
  const { tags: entries, ...edits } = review.data;
  const payload: CandidatePayload = { ...stored.data, ...edits, ...splitTagEntries(entries) };
  // 先把管理员的修改写回候选，失败后再打开也不丢
  await repo.updateCandidatePayload(id, payload, payload.name);

  const category = await repo.reviewLookups.categoryBySlug(payload.categorySlug);
  if (!category) throw new DomainError("分类不存在，请重新选择", "categorySlug");

  const strict = intent === "publish";
  const tags = await planTags(entries, strict);
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
    note: tags.dropped.length ? `以下标签缺少英文 slug 或与已有标签冲突，未添加：${tags.dropped.join("、")}` : undefined,
  };
}

export async function rejectCandidate(id: string) {
  const { count } = await repo.rejectCandidate(id);
  if (count !== 1) throw new DomainError("这条候选不存在或已处理过了");
}
