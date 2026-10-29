"use client";

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { placePopover } from "@/lib/ui/select";
import styles from "./HelpTip.module.css";

export type HelpTipProps = {
  /** 浮层里的说明文字 */
  children: ReactNode;
  /** 图标按钮的无障碍名称，默认「说明」 */
  label?: string;
  className?: string;
};

const OPEN_DELAY = 120;
const CLOSE_DELAY = 160;

/**
 * 手绘风【?】说明图标：鼠标悬浮 / 键盘聚焦 / 点按时弹出说明浮层，移开、失焦、点外部或 Esc 关闭。
 * - 浮层用原生 popover="manual"（top layer），不被卡片、ScrollArea 裁切；位置复用 placePopover（自动上下翻转、贴视口边）。
 * - 放在 <label> 里也安全：点击会 preventDefault，不会顺带勾选复选框。
 * - 说明通过 aria-describedby 关联到按钮，读屏能读到。
 */
export function HelpTip({ children, label = "说明", className }: HelpTipProps) {
  const id = useId();
  const tipId = `${id}-tip`;
  const btnRef = useRef<HTMLButtonElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);

  const place = useCallback(() => {
    const b = btnRef.current;
    const t = tipRef.current;
    if (!b || !t) return;
    const r = b.getBoundingClientRect();
    const pl = placePopover({
      trigger: { top: r.top, bottom: r.bottom, left: r.left - 10 },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      contentHeight: t.scrollHeight,
      popoverWidth: t.offsetWidth,
      maxHeight: 360,
    });
    t.style.left = `${pl.left}px`;
    t.style.maxHeight = `${pl.maxHeight}px`;
    t.style.top = pl.side === "bottom" ? `${pl.offset}px` : "auto";
    t.style.bottom = pl.side === "top" ? `${pl.offset}px` : "auto";
    t.dataset.side = pl.side;
  }, []);

  const show = useCallback(() => {
    clearTimeout(timer.current);
    const t = tipRef.current;
    if (!t || t.matches(":popover-open")) return;
    delete t.dataset.side; // 未定位前 CSS 隐藏，避免在左上角闪一帧
    t.showPopover();
    place(); // showPopover 同步进入布局，可立即测量
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    const t = tipRef.current;
    if (t?.matches(":popover-open")) t.hidePopover();
    setOpen(false);
  }, []);

  const later = (fn: () => void, ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, ms);
  };

  // 打开期间：Esc 关闭，滚动 / 尺寸变化时跟随，点外部关闭（触屏）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") hide();
    };
    const onMove = () => place();
    const onDown = (e: PointerEvent) => {
      const n = e.target as Node;
      if (!btnRef.current?.contains(n) && !tipRef.current?.contains(n)) hide();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { capture: true, passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, { capture: true });
    };
  }, [open, hide, place]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span className={[styles.root, className].filter(Boolean).join(" ")}>
      <button
        ref={btnRef}
        type="button"
        className={styles.btn}
        aria-label={label}
        aria-describedby={tipId}
        aria-expanded={open}
        data-open={open || undefined}
        onPointerEnter={(e) => e.pointerType === "mouse" && later(show, OPEN_DELAY)}
        onPointerLeave={(e) => e.pointerType === "mouse" && later(hide, CLOSE_DELAY)}
        onFocus={show}
        onBlur={hide}
        onClick={(e) => {
          // 在 <label> 里时阻止「点按钮 = 点复选框」
          e.preventDefault();
          e.stopPropagation();
          show(); // 触屏点按打开；点外部 / Esc 关闭
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M9.2 1.6c4.2-.1 7.3 3.1 7.2 7.3-.1 4.1-3.3 7.4-7.5 7.4C4.7 16.4 1.5 13.1 1.6 9 1.7 4.8 5 1.7 9.2 1.6Z"
            fill="currentColor"
            fillOpacity="0.12"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M6.7 7.1c.1-1.4 1.2-2.3 2.5-2.3 1.4 0 2.4.9 2.4 2.1 0 1.6-2.3 1.8-2.4 3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="9.15" cy="13" r="1.05" fill="currentColor" />
        </svg>
      </button>
      <div
        ref={tipRef}
        id={tipId}
        role="tooltip"
        popover="manual"
        className={styles.tip}
        onPointerEnter={(e) => e.pointerType === "mouse" && clearTimeout(timer.current)}
        onPointerLeave={(e) => e.pointerType === "mouse" && later(hide, CLOSE_DELAY)}
      >
        {children}
      </div>
    </span>
  );
}
