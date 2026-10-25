"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./tool.module.css";

/* ---------------- 复制 / 下载（纯本地） ---------------- */

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 权限被拒等情况走降级方案 */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

export function downloadText(fileName: string, text: string, mime = "text/plain") {
  const blob = new Blob([text.endsWith("\n") ? text : `${text}\n`], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------------- 轻提示 ---------------- */

type ToastItem = { id: number; text: string; fail: boolean; leaving: boolean };

const TOAST_MS = 1800;
const TOAST_FAIL_MS = 3200;
const TOAST_LEAVE_MS = 200;
const TOAST_MAX = 3;

/*
 * 全页共用一个右上角提示区（role="status" + aria-live），所有 useToast 实例都渲染进去，
 * 多条提示在同一个弹性列里纵向堆叠、互不重叠。提示区在首个使用者挂载时创建（早于任何提示，
 * 读屏器才能播报后续插入的文字），最后一个使用者卸载时移除。渲染期不访问 document，SSR 安全。
 */
let toastRegion: HTMLElement | null = null;
let toastUsers = 0;
const regionListeners = new Set<() => void>();

function acquireToastRegion() {
  toastUsers += 1;
  if (!toastRegion) {
    const el = document.createElement("div");
    el.className = styles.toastRegion;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    document.body.appendChild(el);
    toastRegion = el;
    regionListeners.forEach((l) => l());
  }
}

function releaseToastRegion() {
  toastUsers -= 1;
  if (toastUsers <= 0 && toastRegion) {
    toastUsers = 0;
    toastRegion.remove();
    toastRegion = null;
    regionListeners.forEach((l) => l());
  }
}

const subscribeRegion = (l: () => void) => {
  regionListeners.add(l);
  return () => void regionListeners.delete(l);
};

export function useToast() {
  const [items, setItems] = useState<ToastItem[]>([]);
  // 列表的同步副本：计时器回调与 show 都基于它计算，副作用不放进 setState 更新函数
  const list = useRef<ToastItem[]>([]);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);
  const region = useSyncExternalStore(subscribeRegion, () => toastRegion, () => null);

  useEffect(() => {
    const map = timers.current;
    acquireToastRegion();
    return () => {
      map.forEach((t) => clearTimeout(t));
      map.clear();
      releaseToastRegion();
    };
  }, []);

  const commit = useCallback((next: ToastItem[]) => {
    list.current = next;
    setItems(next);
  }, []);

  const arm = useCallback(
    (id: number, ms: number) => {
      const map = timers.current;
      clearTimeout(map.get(id));
      map.set(
        id,
        setTimeout(() => {
          commit(list.current.map((x) => (x.id === id ? { ...x, leaving: true } : x)));
          map.set(
            id,
            setTimeout(() => {
              map.delete(id);
              commit(list.current.filter((x) => x.id !== id));
            }, TOAST_LEAVE_MS),
          );
        }, ms),
      );
    },
    [commit],
  );

  const show = useCallback(
    (text: string, fail = false) => {
      const ms = fail ? TOAST_FAIL_MS : TOAST_MS;
      const xs = list.current;
      const last = xs.at(-1);
      // 连续同样的提示（如反复点「复制」）只续期，不重复堆叠
      if (last && !last.leaving && last.text === text && last.fail === fail) {
        arm(last.id, ms);
        return;
      }
      const id = ++nextId.current;
      const next = [...xs, { id, text, fail, leaving: false }];
      // 超出上限时最早的提示直接让位
      const drop = next.slice(0, Math.max(0, next.length - TOAST_MAX));
      for (const old of drop) {
        clearTimeout(timers.current.get(old.id));
        timers.current.delete(old.id);
      }
      commit(next.slice(-TOAST_MAX));
      arm(id, ms);
    },
    [arm, commit],
  );

  const node =
    region && items.length > 0
      ? createPortal(
          items.map((t) => (
            <div key={t.id} className={`${styles.toast} ${t.fail ? styles.fail : ""}`} data-leaving={t.leaving || undefined}>
              {t.text}
            </div>
          )),
          region,
        )
      : null;
  return { show, node };
}

/** 复制并给出成功/失败反馈 */
export function useCopy() {
  const { show, node } = useToast();
  const copy = useCallback(
    async (text: string, okMsg = "已复制 ✓") => {
      const ok = await copyText(text);
      show(ok ? okMsg : "复制失败，请手动选中文本复制", !ok);
      return ok;
    },
    [show],
  );
  return { copy, show, node };
}

/* ---------------- 切换按钮组 ---------------- */

export function Toggle<T extends string>({
  label,
  value,
  options,
  onChange,
  small,
}: {
  label: string;
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <div className={styles.seg} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.toggle} ${small ? styles.sm : ""}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- 轻量语法高亮（React 节点，不使用 innerHTML） ---------------- */

const JSON_TOKEN = /("(?:[^"\\]|\\.)*")(\s*:)?|\b(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)\b/g;

function highlightJsonLine(line: string, key: number): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of line.matchAll(JSON_TOKEN)) {
    const i = m.index ?? 0;
    if (i > last) out.push(line.slice(last, i));
    if (m[1] && m[2]) out.push(<span key={i} className={styles.tk}>{m[1]}</span>, m[2]);
    else if (m[1]) out.push(<span key={i} className={styles.ts}>{m[1]}</span>);
    else out.push(<span key={i} className={styles.tn}>{m[3]}</span>);
    last = i + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return <span key={key}>{out}</span>;
}

const KV_KEY = /^(\s*(?:-\s+)?)([\w.-]+|"[^"]*")(\s*[:=])/;
const KV_SECTION = /^(\s*)(\[\[?[^\]]+\]\]?)\s*$/;
const KV_SCALAR = /("(?:[^"\\]|\\.)*"|'[^']*')|\b(-?\d+(?:\.\d+)?|true|false|null|inf|nan)\b/g;

function highlightKvLine(line: string, key: number): ReactNode {
  if (/^\s*#/.test(line)) return <span key={key} className={styles.tc}>{line}</span>;
  const sec = line.match(KV_SECTION);
  if (sec) return <span key={key}>{sec[1]}<span className={styles.tk}>{sec[2]}</span></span>;
  const out: ReactNode[] = [];
  let rest = line;
  const km = line.match(KV_KEY);
  if (km) {
    out.push(km[1], <span key="k" className={styles.tk}>{km[2]}</span>, km[3]);
    rest = line.slice(km[0].length);
  }
  let last = 0;
  for (const m of rest.matchAll(KV_SCALAR)) {
    const i = m.index ?? 0;
    if (i > last) out.push(rest.slice(last, i));
    out.push(<span key={`v${i}`} className={m[1] ? styles.ts : styles.tn}>{m[0]}</span>);
    last = i + m[0].length;
  }
  if (last < rest.length) out.push(rest.slice(last));
  return <span key={key}>{out}</span>;
}

export function Highlight({ text, lang }: { text: string; lang: "json" | "yaml" | "toml" }) {
  const lines = text.split("\n");
  const fn = lang === "json" ? highlightJsonLine : highlightKvLine;
  return (
    <>
      {lines.map((l, i) => (
        <span key={i}>
          {fn(l, i)}
          {i < lines.length - 1 ? "\n" : null}
        </span>
      ))}
    </>
  );
}

/* ---------------- 图标 ---------------- */

export function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12.5l5 5L20 6" />
    </svg>
  );
}

export function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12c2.6-4.6 6-7 10-7s7.4 2.4 10 7c-2.6 4.6-6 7-10 7s-7.4-2.4-10-7z" />
      <circle cx="12" cy="12" r="3" />
      {off ? <path d="M4 20L20 4" /> : null}
    </svg>
  );
}
