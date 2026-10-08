import Link from "next/link";
import { AdminTop } from "@/components/admin/AdminTop";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import styles from "@/components/admin/admin.module.css";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { ButtonLink, Card, ChipLink } from "@/components/ui";
import type { ResourceStatus } from "@/generated/prisma/client";
import { adminSearch } from "@/lib/data/resource.repo";
import { adminListCategories } from "@/lib/data/taxonomy.repo";
import { resourceStatuses } from "@/lib/validation/resource";
import { changeStatusAction } from "../actions";

export const metadata = { title: "资源管理" };

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminResourcesPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const status = resourceStatuses.includes(sp.status as ResourceStatus) ? (sp.status as ResourceStatus) : undefined;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const q = sp.q?.trim().slice(0, 50) || undefined;
  const cat = sp.cat || undefined;
  const [categories, { total, items, pageSize }] = await Promise.all([
    adminListCategories(),
    adminSearch({ q, cat, status, page }),
  ]);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const href = (patch: Record<string, string | number | undefined>) => {
    const next = { q, cat, status, page: 1, ...patch } as Record<string, string | number | undefined>;
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v && !(k === "page" && v === 1)) p.set(k, String(v));
    const s = p.toString();
    return s ? `/admin/resources?${s}` : "/admin/resources";
  };

  return (
    <>
      <AdminTop title="资源管理" />
      {sp.error && <p className={styles.alert} role="alert">{sp.error}</p>}
      {sp.deleted && <p className={styles.ok} role="status">资源已删除</p>}
      <Card>
        <form className={styles.toolbar} action="/admin/resources">
          <label className={styles.search}>
            <span className="sr-only">搜索资源</span>
            <input type="search" name="q" defaultValue={q} placeholder="搜索名称、slug、标签…" />
          </label>
          <select className={styles.sel} name="cat" defaultValue={cat ?? ""} aria-label="分类">
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.id} value={c.slug}>{c.name}</option>
            ))}
          </select>
          {status && <input type="hidden" name="status" value={status} />}
          <button type="submit" className={styles.sel}>筛选</button>
          <div className={styles.seg} role="group" aria-label="状态">
            <ChipLink href={href({ status: undefined })} active={!status}>全部</ChipLink>
            <ChipLink href={href({ status: "published" })} active={status === "published"}>已发布</ChipLink>
            <ChipLink href={href({ status: "draft" })} active={status === "draft"}>草稿</ChipLink>
            <ChipLink href={href({ status: "archived" })} active={status === "archived"}>已下架</ChipLink>
          </div>
          <ButtonLink href="/admin/resources/new" variant="primary" className={styles.grow}>+ 新增资源</ButtonLink>
        </form>

        <div className={styles.scroll}>
          <table className={styles.tbl}>
            <thead>
              <tr>
                <th scope="col">名称</th>
                <th scope="col">分类</th>
                <th scope="col">标签</th>
                <th scope="col">状态</th>
                <th scope="col">精选</th>
                <th scope="col">更新时间</th>
                <th scope="col">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.muted}>没有符合条件的资源</td>
                </tr>
              )}
              {items.map((r) => {
                const toggleTo = r.status === "published" ? "archived" : "published";
                return (
                  <tr key={r.id}>
                    <th scope="row">{r.name}</th>
                    <td>{r.category.name}</td>
                    <td>{r.tags.slice(0, 3).map(({ tag }) => <span key={tag.id} className={styles.tag}>{tag.name}</span>)}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td className={r.featuredOrder ? styles.star : styles.muted}>{r.featuredOrder ? `★ ${r.featuredOrder}` : "—"}</td>
                    <td className={styles.muted}>{r.updatedAt.toISOString().slice(0, 16).replace("T", " ")}</td>
                    <td>
                      <div className={styles.act}>
                        <Link href={`/admin/resources/${r.id}`}>编辑</Link>
                        {r.status === "published" && (
                          <a href={`/resources/${r.slug}`} target="_blank" rel="noopener noreferrer">查看</a>
                        )}
                        <form action={changeStatusAction.bind(null, r.id)}>
                          <input type="hidden" name="to" value={toggleTo} />
                          {toggleTo === "archived" ? (
                            <ConfirmButton className={styles.warn} message={`确定下架「${r.name}」？前台将立即不可见。`}>下架</ConfirmButton>
                          ) : (
                            <button type="submit">发布</button>
                          )}
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.pager}>
          <span>共 {total} 条</span>
          {pages > 1 && (
            <nav aria-label="分页">
              {page > 1 && <Link href={href({ page: page - 1 })}>‹ 上一页</Link>}
              <span>{page} / {pages}</span>
              {page < pages && <Link href={href({ page: page + 1 })}>下一页 ›</Link>}
            </nav>
          )}
        </div>
      </Card>
    </>
  );
}
