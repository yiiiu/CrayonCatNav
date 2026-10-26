"use server";

import { refresh, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/require-admin";
import { cacheTags } from "@/lib/cache/tags";
import { saveSettings, testConnection } from "@/lib/domain/agent-settings.service";
import { convertCandidate, rejectCandidate } from "@/lib/domain/candidate.service";
import { candidateReturnUrl, type CandidateFilter } from "@/lib/agent/candidate-return";
import { saveCollectConfig } from "@/lib/domain/category-collect.service";
import { collectLink, runCollection } from "@/lib/domain/collector.service";
import { enrichBatch, enrichOne } from "@/lib/domain/enrich.service";
import { setFeatured } from "@/lib/domain/featured.service";
import { changeStatus, removeResource, saveResource, validateResource } from "@/lib/domain/resource.service";
import { type ActionResult, fromDomainError, fromZodError } from "@/lib/domain/result";
import { acceptSuggestion, ignoreSuggestionById, mergeSuggestion } from "@/lib/domain/tag-suggestion.service";
import { removeCategory, removeTag, saveCategory, saveTag } from "@/lib/domain/taxonomy.service";
import { agentSettingsFromForm, collectLinkSchema } from "@/lib/validation/agent";
import { candidateReviewFromForm } from "@/lib/validation/candidate";
import { collectConfigFromForm } from "@/lib/validation/collect-config";
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

/* ---------- 采集 Agent ---------- */
// 采集类 action 可能运行数分钟：最长执行时间由 agent/page.tsx 的 maxDuration 决定（页面级配置作用于该页触发的全部 action）

export async function saveAgentSettingsAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await saveSettings(agentSettingsFromForm(fd));
    if (!r.ok) return fromZodError(r.error);
  } catch (e) {
    return fromDomainError(e);
  }
  refresh(); // 让页面重新渲染：表单回填新值、密钥末四位提示更新
  return { ok: true, message: "设置已保存" };
}

export async function testAgentConnectionAction(_prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  try {
    const { reply } = await testConnection();
    return { ok: true, message: `连接成功，模型回复：${reply || "（空）"}` };
  } catch (e) {
    return fromDomainError(e);
  }
}

export async function runCollectAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  // 目标分类：auto（默认，选资源最少的已配置分类）或分类 id
  const target = (fd.get("target") ?? "auto").toString().slice(0, 64);
  try {
    const r = await runCollection("manual", !target || target === "auto" ? "auto" : { categoryId: target });
    refresh(); // 刷新运行记录与导航里的待审核数量
    return r.status === "failed" ? { ok: false, formError: r.message } : { ok: true, message: r.message };
  } catch (e) {
    return fromDomainError(e);
  }
}

export async function collectLinkAction(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = collectLinkSchema.safeParse({ url: (fd.get("url") ?? "").toString() });
  if (!parsed.success) return fromZodError(parsed.error);
  try {
    const r = await collectLink(parsed.data.url);
    refresh(); // 刷新运行记录与导航里的待审核数量
    if (r.status === "failed" || r.failed > 0) return { ok: false, formError: r.error ?? r.message };
    if (r.created === 0) return { ok: true, message: "没有新增：该链接已在资源库或候选箱中，或模型判断不适合收录（详见运行记录）" };
    return { ok: true, message: "已整理进候选箱，去「候选箱」审核" };
  } catch (e) {
    return fromDomainError(e);
  }
}

export async function saveCollectConfigAction(categoryId: string, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await saveCollectConfig(categoryId, collectConfigFromForm(fd));
    if (!r.ok) return fromZodError(r.error);
    refresh(); // 刷新分类行的状态（已配置 / 参与采集的来源 / 自动会选中的分类）
    return { ok: true, message: `「${r.name}」的采集配置已保存` };
  } catch (e) {
    return fromDomainError(e);
  }
}

/* ---------- 候选箱 ---------- */

export async function reviewCandidateAction(id: string, filter: CandidateFilter | null, _prev: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireAdmin();
  const intent = fd.get("intent") === "draft" ? "draft" : "publish";
  const raw = candidateReviewFromForm(fd);
  let r: Awaited<ReturnType<typeof convertCandidate>>;
  try {
    r = await convertCandidate(id, intent, raw);
  } catch (e) {
    return { ...fromDomainError(e), values: raw };
  }
  updateTag(cacheTags.taxonomy);
  if (intent === "publish") {
    touchResources(r.slug);
    redirect(candidateReturnUrl(filter, `已上架「${raw.name}」`));
  }
  redirect(`/admin/resources/${r.resourceId}?created=candidate${r.note ? `&note=${encodeURIComponent(r.note)}` : ""}`);
}

export async function rejectCandidateAction(id: string, filter: CandidateFilter | null, _prev: ActionResult, _fd?: FormData): Promise<ActionResult> {
  await requireAdmin();
  try {
    await rejectCandidate(id);
  } catch (e) {
    return fromDomainError(e);
  }
  redirect(candidateReturnUrl(filter, "已拒绝，之后不会再推送同一链接"));
}

/* ---------- 标签待定池 ---------- */

const SUG_PATH = "/admin/tag-suggestions";
const back = (key: "done" | "error", msg: string): never => redirect(`${SUG_PATH}?${key}=${encodeURIComponent(msg.slice(0, 200))}`);

async function suggestionStep(run: () => Promise<string>) {
  let msg: string;
  try {
    msg = await run();
  } catch (e) {
    return back("error", fromDomainError(e).formError ?? "操作失败");
  }
  updateTag(cacheTags.taxonomy);
  back("done", msg);
}

export async function acceptSuggestionAction(id: string) {
  await requireAdmin();
  await suggestionStep(async () => `已启用标签「${(await acceptSuggestion(id)).name}」`);
}

export async function mergeSuggestionAction(id: string, fd: FormData) {
  await requireAdmin();
  await suggestionStep(async () => {
    const r = await mergeSuggestion(id, String(fd.get("tagId") ?? ""));
    return `已把「${r.name}」归到「${r.target}」，以后会自动映射`;
  });
}

export async function ignoreSuggestionAction(id: string) {
  await requireAdmin();
  await suggestionStep(async () => {
    await ignoreSuggestionById(id);
    return "已忽略，以后模型再提这个词会直接丢弃";
  });
}

/* ---------- 会话 ---------- */

export async function logoutAction() {
  await signOut({ redirectTo: "/admin/login" });
}

/* ---------- AI 补全资源详情（docs/plan/AI批量补全-实现计划.md） ---------- */

const fieldNames: Record<string, string> = {
  highlights: "核心功能",
  useCases: "适合谁",
  quickstart: "快速上手",
  platforms: "平台",
  pricingNote: "定价说明",
  previewImageUrl: "预览图",
};

/** 批量补全：在「采集 Agent」页触发，受该页 maxDuration=300 约束。 */
export async function enrichBatchAction(_prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await enrichBatch();
    if (r.slugs.length) touchResources(...r.slugs);
    refresh();
    const parts = [`补全 ${r.filled} 条`, r.empty ? `无可补内容 ${r.empty} 条` : "", r.failed ? `失败 ${r.failed} 条（下次重试）` : "", `剩余 ${r.remaining} 条`].filter(Boolean);
    const detail = r.notes.length ? `。${r.notes.slice(0, 3).join("；")}` : "";
    return r.filled + r.empty + r.failed === 0 ? { ok: true, message: "没有需要补全的资源" } : { ok: true, message: `${parts.join("，")}${detail}` };
  } catch (e) {
    return fromDomainError(e);
  }
}

/** 单条补全：编辑页按钮，只填空字段。 */
export async function enrichOneAction(id: string, _prev: ActionResult): Promise<ActionResult> {
  await requireAdmin();
  try {
    const r = await enrichOne(id);
    if (r.filled.length) touchResources(r.slug);
    refresh();
    return r.filled.length
      ? { ok: true, message: `已补全：${r.filled.map((f) => fieldNames[f] ?? f).join("、")}，请核对后保存` }
      : { ok: false, formError: `没有补到内容：${r.note ?? "资料不足"}（已有内容不会被覆盖）` };
  } catch (e) {
    return fromDomainError(e);
  }
}
