"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/domain/result";
import styles from "./admin.module.css";

type Props = {
  kind: "category" | "tag";
  save: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  remove?: (prev: ActionResult) => Promise<ActionResult>;
  initial?: { name: string; slug: string; sortOrder?: number };
  usage?: number;
};

/** 分类/标签的一行：行内编辑 + 删除；新增行不传 initial。 */
export function TaxonomyRow({ kind, save, remove, initial, usage }: Props) {
  const [state, saveAction, saving] = useActionState(save, { ok: true } as ActionResult);
  const [delState, delAction, deleting] = useActionState(remove ?? (async () => ({ ok: true }) as ActionResult), { ok: true } as ActionResult);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const isNew = !initial;
  const label = kind === "category" ? "分类" : "标签";
  const prefix = isNew ? `new-${kind}` : `${kind}-${initial.slug}`;

  return (
    <div>
      <form action={saveAction} className={`${styles.row} ${kind === "tag" ? styles.rowTag : ""}`}>
        <div className={`${styles.field} ${err("name") ? styles.bad : ""}`}>
          <label htmlFor={`${prefix}-name`} className="sr-only">{label}名</label>
          <input id={`${prefix}-name`} name="name" defaultValue={initial?.name} placeholder={`${label}名`} required />
          {err("name") && <p className={styles.err}>{err("name")}</p>}
        </div>
        <div className={`${styles.field} ${err("slug") ? styles.bad : ""}`}>
          <label htmlFor={`${prefix}-slug`} className="sr-only">slug</label>
          <input id={`${prefix}-slug`} name="slug" defaultValue={initial?.slug} placeholder="slug" required />
          {err("slug") && <p className={styles.err}>{err("slug")}</p>}
        </div>
        {kind === "category" && (
          <div className={styles.field}>
            <label htmlFor={`${prefix}-sort`} className="sr-only">排序</label>
            <input id={`${prefix}-sort`} name="sortOrder" type="number" min={0} max={999} defaultValue={initial?.sortOrder ?? 0} />
          </div>
        )}
        <div className={styles.rowActs}>
          <button type="submit" className={styles.linkBtn} disabled={saving}>{isNew ? "+ 新增" : "保存"}</button>
          {!isNew && remove && (
            <button
              type="submit"
              formAction={delAction}
              className={styles.linkBtn}
              style={{ color: "#9b1e1e" }}
              disabled={deleting}
              onClick={(e) => {
                const extra = kind === "tag" && usage ? `，将从 ${usage} 个资源上移除` : "";
                if (!window.confirm(`确定删除${label}「${initial.name}」${extra}？`)) e.preventDefault();
              }}
            >
              删除
            </button>
          )}
          {usage !== undefined && <span className={styles.hint}>{usage} 个资源</span>}
        </div>
      </form>
      {state.ok && state.message && isNew && <p className={styles.hint} role="status">{state.message}</p>}
      {!state.ok && state.formError && !state.fieldErrors && <p className={styles.err} role="alert">{state.formError}</p>}
      {!delState.ok && <p className={styles.err} role="alert">{delState.formError}</p>}
    </div>
  );
}
