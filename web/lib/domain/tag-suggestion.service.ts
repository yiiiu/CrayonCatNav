import "server-only";
import * as repo from "@/lib/data/tag-suggestion.repo";
import { tagInputSchema } from "@/lib/validation/taxonomy";
import { DomainError } from "./result";

/**
 * 标签待定池：启用 / 归到已有标签（记为别名） / 忽略。见 docs/spec/标签治理方案.md 1.5。
 */

const lower = (s: string) => s.trim().toLowerCase();

/** 名称或别名已被哪个标签占用（忽略大小写）；exceptId 为正在编辑的标签自身。 */
export function nameOwner(tags: readonly { id: string; name: string; aliases: string[] }[], name: string, exceptId?: string) {
  const k = lower(name);
  return tags.find((t) => t.id !== exceptId && (lower(t.name) === k || t.aliases.some((a) => lower(a) === k))) ?? null;
}

async function openSuggestion(id: string) {
  const s = await repo.findSuggestion(id);
  if (!s || s.status !== "open") throw new DomainError("这个待定标签不存在或已处理过了");
  return s;
}

export async function acceptSuggestion(id: string) {
  const s = await openSuggestion(id);
  const checked = tagInputSchema.safeParse({ name: s.name, slug: s.slug });
  if (!checked.success) throw new DomainError(`名称或 slug 不合法：${checked.error.issues[0]?.message ?? ""}`);
  const tags = await repo.allTagsForVocab();
  const owner = nameOwner(tags, s.name);
  if (owner) throw new DomainError(`「${s.name}」已是标签「${owner.name}」的名称或别名，请改用「归到」`);
  const slugOwner = tags.find((t) => t.slug === s.slug);
  if (slugOwner) throw new DomainError(`slug「${s.slug}」已被标签「${slugOwner.name}」使用，请改用「归到」或在分类标签页手动新建`);
  const created = await repo.acceptSuggestionTx(id, checked.data);
  if (!created) throw new DomainError("这个待定标签已处理过了");
  return created;
}

export async function mergeSuggestion(id: string, tagId: string) {
  const s = await openSuggestion(id);
  const tags = await repo.allTagsForVocab();
  const target = tags.find((t) => t.id === tagId);
  if (!target) throw new DomainError("请选择要归到的标签");
  const owner = nameOwner(tags, s.name);
  if (owner && owner.id !== target.id) throw new DomainError(`「${s.name}」已是标签「${owner.name}」的名称或别名`);
  // 与目标标签同名或已是它的别名时不重复记录
  const alias = owner ? null : s.name;
  if (!(await repo.mergeSuggestionTx(id, target.id, alias))) throw new DomainError("这个待定标签已处理过了");
  return { name: s.name, target: target.name };
}

export async function ignoreSuggestionById(id: string) {
  const { count } = await repo.ignoreSuggestion(id);
  if (count !== 1) throw new DomainError("这个待定标签不存在或已处理过了");
}
