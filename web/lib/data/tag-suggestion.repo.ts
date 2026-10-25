import "server-only";
import { prisma } from "./prisma";

/** 标签待定池的数据访问（后台专用，不缓存）。 */

export function listOpenSuggestions() {
  return prisma.tagSuggestion.findMany({ where: { status: "open" }, orderBy: [{ hits: "desc" }, { createdAt: "desc" }] });
}

export function countOpenSuggestions() {
  return prisma.tagSuggestion.count({ where: { status: "open" } });
}

export function findSuggestion(id: string) {
  return prisma.tagSuggestion.findUnique({ where: { id } });
}

export function allTagsForVocab() {
  return prisma.tag.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true, aliases: true } });
}

/** 启用：建标签并把待定词标为已启用（只处理仍为 open 的，防重复点击）。 */
export function acceptSuggestionTx(id: string, tag: { name: string; slug: string }) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.tagSuggestion.updateMany({ where: { id, status: "open" }, data: { status: "accepted" } });
    if (claimed.count !== 1) return null;
    const created = await tx.tag.create({ data: tag });
    await tx.tagSuggestion.update({ where: { id }, data: { tagId: created.id } });
    return created;
  });
}

/** 归并：把待定词记为目标标签的别名。 */
export function mergeSuggestionTx(id: string, tagId: string, alias: string | null) {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.tagSuggestion.updateMany({ where: { id, status: "open" }, data: { status: "merged", tagId } });
    if (claimed.count !== 1) return null;
    if (alias) await tx.tag.update({ where: { id: tagId }, data: { aliases: { push: alias } } });
    return true;
  });
}

export function ignoreSuggestion(id: string) {
  return prisma.tagSuggestion.updateMany({ where: { id, status: "open" }, data: { status: "ignored" } });
}
