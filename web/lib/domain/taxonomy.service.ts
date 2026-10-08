import "server-only";
import { categoryRepo, tagRepo } from "@/lib/data/taxonomy.repo";
import { categoryInputSchema, tagInputSchema } from "@/lib/validation/taxonomy";
import { DomainError } from "./result";

export async function saveCategory(id: string | null, raw: unknown) {
  const parsed = categoryInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  const clash = await categoryRepo.findBySlug(parsed.data.slug);
  if (clash && clash.id !== id) throw new DomainError("分类 slug 已存在", "slug");
  const saved = id ? await categoryRepo.update(id, parsed.data) : await categoryRepo.create(parsed.data);
  return { ok: true as const, saved };
}

export async function removeCategory(id: string) {
  const n = await categoryRepo.countResources(id);
  if (n > 0) throw new DomainError(`该分类下还有 ${n} 个资源，先移走再删除`);
  await categoryRepo.delete(id);
}

export async function saveTag(id: string | null, raw: unknown) {
  const parsed = tagInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  const clash = await tagRepo.findBySlug(parsed.data.slug);
  if (clash && clash.id !== id) throw new DomainError("标签 slug 已存在", "slug");
  const saved = id ? await tagRepo.update(id, parsed.data) : await tagRepo.create(parsed.data);
  return { ok: true as const, saved };
}

/** 删除标签会同时解除它与资源的关联（级联）。 */
export const removeTag = (id: string) => tagRepo.delete(id);
