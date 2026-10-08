"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cacheTags } from "@/lib/cache/tags";
import { setFeatured } from "@/lib/domain/featured.service";
import { changeStatus, removeResource, saveResource, validateResource } from "@/lib/domain/resource.service";
import { type ActionResult, fromDomainError, fromZodError } from "@/lib/domain/result";
import { removeCategory, removeTag, saveCategory, saveTag } from "@/lib/domain/taxonomy.service";
import { resourceFormToObject, resourceStatuses } from "@/lib/validation/resource";

function touchResources(...slugs: string[]) {
  updateTag(cacheTags.resources);
  updateTag(cacheTags.home);
  for (const s of slugs) updateTag(cacheTags.resource(s));
}

/* ---------- 资源 ---------- */

export async function saveResourceAction(id: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  let saved: { id: string; slug: string };
  const raw = resourceFormToObject(fd);
  try {
    const v = await validateResource(raw, id);
    if (!v.ok) return { ...fromZodError(v.error), values: raw };
    const prevSlug = (fd.get("prevSlug") ?? "").toString();
    saved = await saveResource(id, v.input);
    touchResources(saved.slug, ...(prevSlug && prevSlug !== saved.slug ? [prevSlug] : []));
    updateTag(cacheTags.taxonomy);
  } catch (e) {
    return { ...fromDomainError(e), values: raw };
  }
  if (!id) redirect(`/admin/resources/${saved.id}?created=1`);
  return { ok: true, message: "已保存" };
}

export async function changeStatusAction(id: string, fd: FormData) {
  await requireAdmin();
  const to = fd.get("to");
  if (!resourceStatuses.includes(to as (typeof resourceStatuses)[number])) return;
  try {
    const { slug } = await changeStatus(id, to as (typeof resourceStatuses)[number]);
    touchResources(slug);
    updateTag(cacheTags.taxonomy);
  } catch (e) {
    const r = fromDomainError(e);
    if (!r.ok) redirect(`/admin/resources?error=${encodeURIComponent(r.formError ?? "操作失败")}`);
  }
}

export async function deleteResourceAction(id: string) {
  await requireAdmin();
  const { slug } = await removeResource(id);
  touchResources(slug);
  updateTag(cacheTags.taxonomy);
  redirect("/admin/resources?deleted=1");
}

/* ---------- 分类与标签 ---------- */

export async function saveCategoryAction(id: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await saveCategory(id, Object.fromEntries(fd));
    if (!r.ok) return fromZodError(r.error);
  } catch (e) {
    return fromDomainError(e);
  }
  updateTag(cacheTags.taxonomy);
  updateTag(cacheTags.resources);
  return { ok: true, message: id ? "已保存" : "已新增" };
}

export async function deleteCategoryAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  try {
    await removeCategory(id);
  } catch (e) {
    return fromDomainError(e);
  }
  updateTag(cacheTags.taxonomy);
  return { ok: true };
}

export async function saveTagAction(id: string | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await saveTag(id, Object.fromEntries(fd));
    if (!r.ok) return fromZodError(r.error);
  } catch (e) {
    return fromDomainError(e);
  }
  updateTag(cacheTags.taxonomy);
  updateTag(cacheTags.resources);
  return { ok: true, message: id ? "已保存" : "已新增" };
}

export async function deleteTagAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  await removeTag(id);
  updateTag(cacheTags.taxonomy);
  updateTag(cacheTags.resources);
  return { ok: true };
}

/* ---------- 精选 ---------- */

export async function saveFeaturedAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await setFeatured(fd.getAll("ids").map(String));
  } catch (e) {
    return fromDomainError(e);
  }
  touchResources();
  return { ok: true, message: "首页精选已更新" };
}

/* ---------- 会话 ---------- */

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}
