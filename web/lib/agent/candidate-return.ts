/**
 * 候选箱审核后的回跳地址：保留当前的状态 / 分类 / 页码筛选，
 * 避免上架或拒绝后筛选被重置成「全部分类」。
 * 入参来自客户端绑定：路径固定、参数经 URLSearchParams 编码，不会跳出候选箱；
 * 分类 slug 只做长度限制，不认识的值由候选箱页面自行忽略。
 */
const STATUSES = new Set(["pending", "published", "drafted", "rejected"]);

export type CandidateFilter = { status?: string | null; cat?: string | null; page?: number | null };

export function candidateReturnUrl(filter: CandidateFilter | null | undefined, done: string): string {
  const p = new URLSearchParams();
  const f = filter ?? {};
  if (f.status && STATUSES.has(f.status) && f.status !== "pending") p.set("status", f.status);
  if (typeof f.cat === "string" && f.cat.length > 0 && f.cat.length <= 100) p.set("cat", f.cat);
  const page = Number(f.page);
  if (Number.isInteger(page) && page > 1 && page <= 500) p.set("page", String(page));
  p.set("done", done.slice(0, 200));
  return `/admin/candidates?${p.toString()}`;
}
