import "server-only";
import { categoryRepo, tagRepo } from "@/lib/data/taxonomy.repo";
import { categoryInputSchema, tagFormSchema } from "@/lib/validation/taxonomy";
import { nameOwner } from "./tag-suggestion.service";
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

/** 保存标签：slug 唯一；名称与别名都不能是其他标签的名称或别名（词表里一个词只能指向一个标签）。 */
export async function saveTag(id: string | null, raw: unknown) {
  const parsed = tagFormSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  const clash = await tagRepo.findBySlug(parsed.data.slug);
  if (clash && clash.id !== id) throw new DomainError("标签 slug 已存在", "slug");
  const all = await tagRepo.allForVocab();
  const nameClash = nameOwner(all, parsed.data.name, id ?? undefined);
  if (nameClash) throw new DomainError(`「${parsed.data.name}」已是标签「${nameClash.name}」的名称或别名`, "name");
  const data = { ...parsed.data, aliases: parsed.data.aliases.filter((a) => a.toLowerCase() !== parsed.data.name.toLowerCase()) };
  for (const a of data.aliases) {
    const owner = nameOwner(all, a, id ?? undefined);
    if (owner) throw new DomainError(`别名「${a}」已是标签「${owner.name}」的名称或别名`, "aliases");
  }
  const saved = id ? await tagRepo.update(id, data) : await tagRepo.create(data);
  return { ok: true as const, saved };
}

/** 删除标签会同时解除它与资源的关联（级联）。 */
export const removeTag = (id: string) => tagRepo.delete(id);

/** 合并后的别名：目标原别名 + 来源名称与别名，去重（忽略大小写），不含目标自身名称。 */
export function mergedAliases(target: { name: string; aliases: string[] }, source: { name: string; aliases: string[] }): string[] {
  const out: string[] = [];
  const seen = new Set([target.name.toLowerCase()]);
  for (const a of [...target.aliases, source.name, ...source.aliases]) {
    const k = a.trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(a.trim());
  }
  return out;
}

/** 把来源标签合并进目标标签：资源转移、来源名称变成目标的别名、来源删除。 */
export async function mergeTag(sourceId: string, targetId: string) {
  if (!sourceId || !targetId) throw new DomainError("请选择要合并的两个标签");
  if (sourceId === targetId) throw new DomainError("不能合并到自己");
  const [source, target] = await Promise.all([tagRepo.findById(sourceId), tagRepo.findById(targetId)]);
  if (!source || !target) throw new DomainError("标签不存在，可能已被删除");
  const slugs = await tagRepo.merge(source.id, target.id, mergedAliases(target, source));
  return { source: source.name, target: target.name, slugs };
}
