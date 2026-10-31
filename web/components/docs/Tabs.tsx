"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import styles from "./docs.module.css";

export type TabItem = { id: string; label: string; content: ReactNode };

/** 简单标签页（WAI-ARIA tabs）：←/→/Home/End 切换，只渲染当前面板。 */
export function Tabs({ items, label }: { items: TabItem[]; label: string }) {
  const [active, setActive] = useState(items[0]?.id);
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = Math.max(0, items.findIndex((t) => t.id === active));

  function onKey(e: KeyboardEvent) {
    const n = items.length;
    const next = e.key === "ArrowRight" ? (idx + 1) % n : e.key === "ArrowLeft" ? (idx - 1 + n) % n : e.key === "Home" ? 0 : e.key === "End" ? n - 1 : -1;
    if (next < 0) return;
    e.preventDefault();
    setActive(items[next].id);
    refs.current[next]?.focus();
  }

  const cur = items[idx];
  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label={label} className={styles.tablist} onKeyDown={onKey}>
        {items.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${base}-${t.id}-tab`}
            aria-controls={`${base}-${t.id}-panel`}
            aria-selected={t.id === cur.id}
            tabIndex={t.id === cur.id ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-${cur.id}-panel`} aria-labelledby={`${base}-${cur.id}-tab`} className={styles.panel}>
        {cur.content}
      </div>
    </div>
  );
}
