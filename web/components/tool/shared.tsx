"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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

type ToastState = { text: string; fail?: boolean } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const show = useCallback((text: string, fail = false) => {
    clearTimeout(timer.current);
    setToast({ text, fail });
    timer.current = setTimeout(() => setToast(null), 1800);
  }, []);
  const node = (
    <div role="status" aria-live="polite">
      {toast ? <div className={`${styles.toast} ${toast.fail ? styles.fail : ""}`}>{toast.text}</div> : null}
    </div>
  );
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
