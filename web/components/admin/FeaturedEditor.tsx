"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import styles from "./admin.module.css";

type Item = { id: string; name: string; note?: string };

type Props = {
  action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  initial: Item[];
  candidates: Item[];
  max: number;
};

/** 精选排序：上移/下移/移除/添加，保存时按顺序提交 ids。 */
export function FeaturedEditor({ action, initial, candidates, max }: Props) {
  const [items, setItems] = useState(initial);
  const [pick, setPick] = useState("");
  const [state, formAction, pending] = useActionState(action, { ok: true } as ActionResult);
  const pool = candidates.filter((c) => !items.some((i) => i.id === c.id));

  const move = (i: number, d: -1 | 1) =>
    setItems((xs) => {
      const next = [...xs];
      [next[i], next[i + d]] = [next[i + d], next[i]];
      return next;
    });

  return (
    <form action={formAction}>
      {!state.ok && <p className={styles.alert} role="alert">{state.formError}</p>}
      {state.ok && state.message && <p className={styles.ok} role="status">{state.message}</p>}
      {items.length === 0 && <p className={styles.hint}>还没有精选，首页将不显示「精选资源」区块。</p>}
      <ol className={styles.flist}>
        {items.map((it, i) => (
          <li key={it.id} className={styles.fitem}>
            <input type="hidden" name="ids" value={it.id} />
            <span className={styles.num} aria-hidden="true">{i + 1}</span>
            <b>
              {it.name}
              {it.note && <span className={styles.hint}>（{it.note}）</span>}
            </b>
            <button type="button" className={styles.linkBtn} onClick={() => move(i, -1)} disabled={i === 0} aria-label={`上移 ${it.name}`}>↑</button>
            <button type="button" className={styles.linkBtn} onClick={() => move(i, 1)} disabled={i === items.length - 1} aria-label={`下移 ${it.name}`}>↓</button>
            <button type="button" className={styles.linkBtn} style={{ color: "#9b1e1e" }} onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))}>
              移除
            </button>
          </li>
        ))}
      </ol>
      <div className={styles.toolbar} style={{ marginTop: 16 }}>
        <label className="sr-only" htmlFor="pick">选择要加入精选的资源</label>
        <select id="pick" className={styles.sel} value={pick} onChange={(e) => setPick(e.target.value)} disabled={items.length >= max}>
          <option value="">{pool.length ? "选择已发布资源…" : "没有可加入的已发布资源"}</option>
          {pool.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <Button
          disabled={!pick || items.length >= max}
          onClick={() => {
            const c = pool.find((x) => x.id === pick);
            if (c) setItems((xs) => [...xs, c]);
            setPick("");
          }}
        >
          + 加入
        </Button>
        <span className={styles.hint}>{items.length}/{max}，首页展示前 6 个</span>
        <Button type="submit" variant="primary" className={styles.grow} disabled={pending}>
          {pending ? "保存中…" : "保存顺序"}
        </Button>
      </div>
    </form>
  );
}
