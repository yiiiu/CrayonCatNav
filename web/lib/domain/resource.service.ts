import "server-only";
import * as repo from "@/lib/data/resource.repo";
import type { ResourceStatus } from "@/generated/prisma/client";
import { resourceInputSchema, type ResourceInput } from "@/lib/validation/resource";
import { DomainError } from "./result";

/** 校验 + 业务规则：slug 唯一；返回写库所需数据。 */
export async function validateResource(raw: unknown, id: string | null) {
  const parsed = resourceInputSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  const input: ResourceInput = parsed.data;
  const clash = await repo.findBySlugAny(input.slug);
  if (clash && clash.id !== id) throw new DomainError("这个 slug 已被其他资源使用", "slug");
  return { ok: true as const, input };
}

function toWrite(input: ResourceInput): repo.ResourceWrite {
  return {
    ...input,
    websiteUrl: input.websiteUrl ?? null,
    githubUrl: input.githubUrl ?? null,
    iconUrl: input.iconUrl ?? null,
  };
}

export async function saveResource(id: string | null, input: ResourceInput) {
  const saved = id ? await repo.updateResource(id, toWrite(input)) : await repo.createResource(toWrite(input));
  return { id: saved.id, slug: saved.slug };
}

const allowedTransitions: Record<ResourceStatus, ResourceStatus[]> = {
  draft: ["published", "archived"],
  published: ["archived", "draft"],
  archived: ["published", "draft"],
};

export async function changeStatus(id: string, to: ResourceStatus) {
  const current = await repo.findById(id);
  if (!current) throw new DomainError("资源不存在或已删除");
  if (!allowedTransitions[current.status].includes(to)) throw new DomainError("当前状态不能这样切换");
  if (to === "published") {
    // 发布走完整校验，避免绕过表单发布不完整资源
    const check = resourceInputSchema.safeParse({
      ...current,
      websiteUrl: current.websiteUrl ?? "",
      githubUrl: current.githubUrl ?? "",
      iconUrl: current.iconUrl ?? "",
      status: "published",
      tagIds: current.tags.map((t) => t.tagId),
      toolIds: current.tools.map((t) => t.toolId),
    });
    if (!check.success) throw new DomainError(`无法发布：${check.error.issues[0]?.message ?? "信息不完整"}`);
  }
  return repo.setStatus(id, to);
}

export const removeResource = (id: string) => repo.deleteResource(id);
