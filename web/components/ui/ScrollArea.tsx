"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type ComponentPropsWithRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type Ref,
} from "react";
import { dragToScroll, thumbMetrics, trackClickScroll, type ThumbMetrics } from "@/lib/ui/scrollbar";
import styles from "./ScrollArea.module.css";

export type ScrollOrientation = "vertical" | "horizontal" | "both";

export type ScrollAreaProps = Omit<ComponentPropsWithRef<"div">, "className" | "style"> & {
  /** 外层容器类名：沿用原有的 flex:1 / min-height:0 / 外边距等布局 */
  className?: string;
  style?: CSSProperties;
  /** 真正的滚动容器（viewport）类名：放内容布局（grid / gap / padding / max-height） */
  viewportClassName?: string;
  viewportStyle?: CSSProperties;
  /** 滚动方向，默认纵向；资源表格这类宽内容用 both */
  orientation?: ScrollOrientation;
};

type AxisKey = "y" | "x";
type AxisState = { enabled: boolean; m: ThumbMetrics };
type Drag = { axis: AxisKey; pointerId: number; start: number; startScroll: number; size: number };

const HIDDEN: ThumbMetrics = { visible: false, size: 0, offset: 0 };
const IDLE_MS = 900;
const scrollable = (v: string) => v === "auto" || v === "scroll";

function setRef<T>(ref: Ref<T> | undefined, value: T | null): void | (() => void) {
  if (typeof ref === "function") return ref(value) as void | (() => void);
  if (ref) (ref as { current: T | null }).current = value;
}

/**
 * 手绘风自定义滚动条。
 * - viewport 仍是原生滚动容器（滚轮、触控板、触屏惯性、键盘、Tab 聚焦滚动、position: sticky、
 *   dnd-kit 的边缘自动滚动都照常工作），只是隐藏了原生滚动条，叠加一层装饰性的轨道 + 拇指。
 * - 拇指尺寸/位置由 ResizeObserver（容器 + 直接子元素）与 scroll（rAF 节流）驱动，直接写 DOM，不触发 React 重渲染。
 * - 可拖动拇指、点击轨道翻页；内容不溢出或 viewport 被样式解除滚动（overflow: visible）时不显示。
 * - 触屏（pointer: coarse）上轨道不拦截指针，只做滚动位置指示。
 * - 渲染期不访问 window / document，SSR 安全。
 */
export function ScrollArea({
  className,
  style,
  viewportClassName,
  viewportStyle,
  orientation = "vertical",
  ref,
  children,
  ...viewportProps
}: ScrollAreaProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const vpRef = useRef<HTMLDivElement | null>(null);
  const trackRef = useRef<Record<AxisKey, HTMLDivElement | null>>({ y: null, x: null });
  const thumbRef = useRef<Record<AxisKey, HTMLDivElement | null>>({ y: null, x: null });
  const axisRef = useRef<Record<AxisKey, AxisState>>({ y: { enabled: false, m: HIDDEN }, x: { enabled: false, m: HIDDEN } });
  const dragRef = useRef<Drag | null>(null);

  const hasY = orientation !== "horizontal";
  const hasX = orientation !== "vertical";

  const setViewport = useCallback(
    (el: HTMLDivElement | null) => {
      vpRef.current = el;
      const cleanup = setRef(ref, el);
      return () => {
        vpRef.current = null;
        if (cleanup) cleanup();
        else setRef(ref, null);
      };
    },
    [ref],
  );

  useEffect(() => {
    const vp = vpRef.current;
    const root = rootRef.current;
    if (!vp || !root) return;
    const axes: AxisKey[] = [...(hasY ? (["y"] as const) : []), ...(hasX ? (["x"] as const) : [])];

    const sync = (full: boolean) => {
      const cs = full ? getComputedStyle(vp) : null;
      for (const k of axes) {
        const track = trackRef.current[k];
        const thumb = thumbRef.current[k];
        const st = axisRef.current[k];
        if (!track || !thumb) continue;
        if (cs) st.enabled = scrollable(k === "y" ? cs.overflowY : cs.overflowX);
        const m = st.enabled
          ? thumbMetrics(
              k === "y"
                ? { viewport: vp.clientHeight, content: vp.scrollHeight, track: track.clientHeight, scroll: vp.scrollTop }
                : { viewport: vp.clientWidth, content: vp.scrollWidth, track: track.clientWidth, scroll: vp.scrollLeft },
            )
          : HIDDEN;
        st.m = m;
        if (m.visible) track.setAttribute("data-visible", "");
        else track.removeAttribute("data-visible");
        if (k === "y") {
          thumb.style.height = `${m.size}px`;
          thumb.style.transform = `translate3d(0, ${m.offset}px, 0)`;
        } else {
          thumb.style.width = `${m.size}px`;
          thumb.style.transform = `translate3d(${m.offset}px, 0, 0)`;
        }
      }
    };

    let raf = 0;
    let needFull = false;
    const schedule = (full: boolean) => {
      needFull ||= full;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const f = needFull;
        needFull = false;
        sync(f);
      });
    };

    let idle: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      schedule(false);
      root.setAttribute("data-active", "");
      clearTimeout(idle);
      idle = setTimeout(() => root.removeAttribute("data-active"), IDLE_MS);
    };
    vp.addEventListener("scroll", onScroll, { passive: true });

    let ro: ResizeObserver | undefined;
    const observeAll = () => {
      if (!ro) return;
      ro.disconnect();
      ro.observe(vp);
      for (const k of axes) if (trackRef.current[k]) ro.observe(trackRef.current[k]);
      for (const c of Array.from(vp.children)) ro.observe(c);
    };
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => schedule(true));
      observeAll();
    }
    // 内容增删（流式渲染、列表增减）时重新观察直接子元素
    const mo = typeof MutationObserver !== "undefined" ? new MutationObserver(() => (observeAll(), schedule(true))) : undefined;
    mo?.observe(vp, { childList: true });
    // 媒体查询切换 overflow（窄屏解除锁定）不一定改变尺寸，窗口尺寸变化时兜底全量重算
    const onResize = () => schedule(true);
    window.addEventListener("resize", onResize);
    schedule(true);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(idle);
      vp.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro?.disconnect();
      mo?.disconnect();
    };
  }, [hasX, hasY]);

  const onTrackDown = (axis: AxisKey) => (e: ReactPointerEvent<HTMLDivElement>) => {
    const vp = vpRef.current;
    const thumb = thumbRef.current[axis];
    const st = axisRef.current[axis];
    if (!vp || !thumb || !st.m.visible || e.button !== 0 || e.pointerType === "touch") return;
    e.preventDefault(); // 不抢焦点、不选中文字
    const y = axis === "y";
    const a = {
      viewport: y ? vp.clientHeight : vp.clientWidth,
      content: y ? vp.scrollHeight : vp.scrollWidth,
      track: y ? e.currentTarget.clientHeight : e.currentTarget.clientWidth,
      scroll: y ? vp.scrollTop : vp.scrollLeft,
    };

    if (thumb.contains(e.target as Node)) {
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = { axis, pointerId: e.pointerId, start: y ? e.clientY : e.clientX, startScroll: a.scroll, size: st.m.size };
      rootRef.current?.setAttribute("data-dragging", "");
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = y ? e.clientY - rect.top : e.clientX - rect.left;
    const target = trackClickScroll(a, pos, st.m);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    vp.scrollTo({ [y ? "top" : "left"]: target, behavior: reduce ? "auto" : "smooth" });
  };

  const onTrackMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    const vp = vpRef.current;
    if (!d || !vp || d.pointerId !== e.pointerId) return;
    const y = d.axis === "y";
    const a = {
      viewport: y ? vp.clientHeight : vp.clientWidth,
      content: y ? vp.scrollHeight : vp.scrollWidth,
      track: y ? e.currentTarget.clientHeight : e.currentTarget.clientWidth,
    };
    const next = dragToScroll(a, d.startScroll, (y ? e.clientY : e.clientX) - d.start, d.size);
    if (y) vp.scrollTop = next;
    else vp.scrollLeft = next;
  };

  const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    rootRef.current?.removeAttribute("data-dragging");
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const track = (axis: AxisKey) => (
    <div
      className={styles.track}
      data-axis={axis}
      aria-hidden="true"
      ref={(el) => {
        trackRef.current[axis] = el;
      }}
      onPointerDown={onTrackDown(axis)}
      onPointerMove={onTrackMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onLostPointerCapture={endDrag}
    >
      <div
        className={styles.thumb}
        ref={(el) => {
          thumbRef.current[axis] = el;
        }}
      />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className ?? ""}`}
      style={style}
      data-scroll-area=""
      data-orientation={orientation}
    >
      <div
        {...viewportProps}
        ref={setViewport}
        className={`${styles.viewport} ${viewportClassName ?? ""}`}
        style={viewportStyle}
        data-scroll-viewport=""
      >
        {children}
      </div>
      {hasY && track("y")}
      {hasX && track("x")}
    </div>
  );
}
