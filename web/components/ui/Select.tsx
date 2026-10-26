"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ToggleEvent,
} from "react";
import {
  filterOptions,
  firstEnabled,
  initialActive,
  lastEnabled,
  placePopover,
  stepEnabled,
  typeahead,
  type SelectOption,
} from "@/lib/ui/select";
import { ScrollArea } from "./ScrollArea";
import styles from "./Select.module.css";

export type { SelectOption };

export type SelectProps = {
  options: readonly SelectOption[];
  /** 受控值；不传则为非受控，配合 defaultValue */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** 表单字段名：内部渲染一个隐藏的原生 <select>，可直接用于 <form> / server action / GET 筛选 */
  name?: string;
  /** 触发按钮的 id，供 <label htmlFor> 关联 */
  id?: string;
  /** 当前值不在选项里（通常为 ""）时显示的占位文字 */
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  /** 校验失败的红框；也会设置 aria-invalid */
  invalid?: boolean;
  /** 弹层顶部的实时搜索框。默认按选项数自动开启（超过 SEARCH_AUTO_MIN 个），传 true / false 强制开关 */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** 搜索无结果时的文字 */
  emptyText?: string;
  className?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
};

const TYPEAHEAD_MS = 600;
const PAGE = 8;
/** 选项数超过该值时自动显示搜索框 */
export const SEARCH_AUTO_MIN = 8;

/**
 * 手绘风下拉框（select-only combobox + listbox）。
 * - 弹层用原生 popover（top layer）：不会被卡片、ScrollArea 等 overflow 容器裁切；点外部 / Esc 自动关闭。
 * - 键盘：↑↓ 打开与移动、Home/End、PageUp/PageDown、Enter/空格选择、Esc 关闭、Tab 离开、输入首字母跳转。
 * - 表单：渲染隐藏的原生 <select name>，提交、required 校验、form.reset() 都按原生行为工作。
 * - 渲染期不访问 window / document，SSR 安全。
 */
export function Select({
  options,
  value,
  defaultValue = "",
  onValueChange,
  name,
  id,
  placeholder = "请选择",
  disabled,
  required,
  invalid,
  searchable: searchableProp,
  searchPlaceholder = "搜索…",
  emptyText = "没有匹配项",
  className,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
}: SelectProps) {
  const baseId = useId();
  const triggerId = id ?? `${baseId}-trigger`;
  const popId = `${baseId}-pop`;
  const listId = `${baseId}-list`;
  const optId = (i: number) => `${baseId}-opt-${i}`;

  const searchable = searchableProp ?? options.length > SEARCH_AUTO_MIN;
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue);
  const current = controlled ? value : inner;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [query, setQuery] = useState("");
  const [nativeInvalid, setNativeInvalid] = useState(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const nativeRef = useRef<HTMLSelectElement>(null);
  // 关闭状态下按键打开时（首字母 / Home / End）要落到的高亮项；toggle 事件是异步的，先暂存
  const pendingActive = useRef<number | null>(null);
  // 可搜索时，在关闭的触发器上直接打字：首个字符带进搜索框
  const pendingQuery = useRef("");
  const typed = useRef({ text: "", timer: undefined as ReturnType<typeof setTimeout> | undefined });

  const selectedIndex = options.findIndex((o) => o.value === current);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;
  const visible = useMemo(
    () => (searchable ? filterOptions(options, query) : options.map((_, i) => i)),
    [options, query, searchable],
  );
  // 键盘导航在「当前可见」的选项里进行；active 存原数组下标，保证 aria-activedescendant 稳定
  const visibleOpts = useMemo(() => visible.map((i) => options[i]), [visible, options]);
  const activePos = visible.indexOf(active);

  const show = useCallback(() => {
    if (!disabled) popRef.current?.showPopover();
  }, [disabled]);
  const hide = useCallback(() => {
    const p = popRef.current;
    if (p?.matches(":popover-open")) p.hidePopover();
  }, []);

  const commit = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    if (!controlled) setInner(o.value);
    setNativeInvalid(false);
    if (o.value !== current) onValueChange?.(o.value);
    hide();
    triggerRef.current?.focus();
  };

  // 定位：打开时、窗口尺寸变化或任意祖先滚动时重新计算（rAF 合并）
  const place = useCallback(() => {
    const t = triggerRef.current;
    const p = popRef.current;
    const vp = listRef.current;
    if (!t || !p || !vp) return;
    const r = t.getBoundingClientRect();
    p.style.minWidth = `${r.width}px`;
    const chrome = p.offsetHeight - vp.clientHeight;
    const pl = placePopover({
      trigger: { top: r.top, bottom: r.bottom, left: r.left },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      contentHeight: vp.scrollHeight + chrome,
      popoverWidth: p.offsetWidth,
    });
    p.style.left = `${pl.left}px`;
    p.style.maxHeight = `${pl.maxHeight}px`;
    p.style.top = pl.side === "bottom" ? `${pl.offset}px` : "auto";
    p.style.bottom = pl.side === "top" ? `${pl.offset}px` : "auto";
    p.dataset.side = pl.side;
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    let raf = 0;
    const schedule = (e?: Event) => {
      // 弹层内部列表滚动不需要重新定位
      if (e && e.target instanceof Node && popRef.current?.contains(e.target)) return;
      if (!raf) raf = requestAnimationFrame(() => ((raf = 0), place()));
    };
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, { capture: true });
    };
  }, [open, place, visible.length]);

  // 高亮项滚动到可见范围
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${baseId}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, baseId]);

  // 表单 reset：恢复 defaultValue（受控模式由使用方负责）
  useEffect(() => {
    const form = nativeRef.current?.form;
    if (!form || controlled) return;
    const onReset = () => {
      setInner(defaultValue);
      setNativeInvalid(false);
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [controlled, defaultValue]);

  useEffect(() => () => clearTimeout(typed.current.timer), []);

  const onToggle = (e: ToggleEvent<HTMLDivElement>) => {
    const isOpen = e.newState === "open";
    setOpen(isOpen);
    if (isOpen) {
      const q = pendingQuery.current;
      pendingQuery.current = "";
      setQuery(q);
      if (q) {
        const hits = filterOptions(options, q);
        setActive(hits.find((i) => !options[i].disabled) ?? -1);
      } else {
        setActive(pendingActive.current ?? initialActive(options, current));
      }
      pendingActive.current = null;
      if (searchable) searchRef.current?.focus();
    } else {
      // 只在焦点还留在弹层里时（如 Esc 关闭搜索框）把焦点还给触发器，点外部关闭时不抢焦点
      const ae = document.activeElement;
      if (ae && popRef.current?.contains(ae)) triggerRef.current?.focus();
    }
  };

  const moveTo = (pos: number) => {
    if (pos >= 0 && pos < visible.length) setActive(visible[pos]);
  };

  /** 返回 true 表示已处理（调用方 preventDefault） */
  const navigate = (e: KeyboardEvent): boolean => {
    const from = activePos;
    switch (e.key) {
      case "ArrowDown":
        if (e.altKey) return true;
        moveTo(from < 0 ? firstEnabled(visibleOpts) : stepEnabled(visibleOpts, from, 1));
        return true;
      case "ArrowUp":
        if (e.altKey) {
          if (active >= 0) commit(active);
          else hide();
          return true;
        }
        moveTo(from < 0 ? lastEnabled(visibleOpts) : stepEnabled(visibleOpts, from, -1));
        return true;
      case "Home":
        moveTo(firstEnabled(visibleOpts));
        return true;
      case "End":
        moveTo(lastEnabled(visibleOpts));
        return true;
      case "PageDown":
        moveTo(stepEnabled(visibleOpts, from, 1, PAGE));
        return true;
      case "PageUp":
        moveTo(stepEnabled(visibleOpts, Math.max(from, 0), -1, PAGE));
        return true;
      case "Enter":
        if (active >= 0) commit(active);
        return true;
      case "Escape":
        hide();
        return true;
      case "Tab":
        hide();
        return false;
      default:
        return false;
    }
  };

  const runTypeahead = (ch: string) => {
    const t = typed.current;
    clearTimeout(t.timer);
    t.text += ch;
    t.timer = setTimeout(() => (t.text = ""), TYPEAHEAD_MS);
    if (open) {
      const pos = typeahead(visibleOpts, t.text, activePos < 0 ? -1 : activePos);
      if (pos >= 0) moveTo(pos);
    } else {
      // 关闭时 visible 即全部选项；从已选中项之后开始找
      const pos = typeahead(options, t.text, selectedIndex);
      if (pos >= 0) pendingActive.current = pos;
    }
  };

  const onTriggerKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const printable = e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
        e.preventDefault();
        if (e.key === "Home") pendingActive.current = firstEnabled(options);
        if (e.key === "End") pendingActive.current = lastEnabled(options);
        show();
      } else if (printable && e.key !== " ") {
        e.preventDefault();
        if (searchable) pendingQuery.current = e.key;
        else runTypeahead(e.key);
        show();
      }
      // Enter / 空格交给按钮原生 click（popoverTarget 负责打开）
      return;
    }
    if (e.key === " " && !typed.current.text) {
      e.preventDefault();
      if (active >= 0) commit(active);
      return;
    }
    if (navigate(e)) {
      e.preventDefault();
      return;
    }
    if (printable) {
      e.preventDefault();
      runTypeahead(e.key);
    }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 搜索框里 Home/End/空格属于文本编辑
    if (e.key === "Home" || e.key === "End") return;
    if (navigate(e)) e.preventDefault();
  };

  const showInvalid = invalid || nativeInvalid;

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")}>
      <button
        ref={triggerRef}
        id={triggerId}
        type="button"
        role="combobox"
        className={styles.trigger}
        popoverTarget={popId}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && !searchable && active >= 0 ? optId(active) : undefined}
        aria-invalid={showInvalid || undefined}
        aria-required={required || undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        data-open={open || undefined}
        onKeyDown={onTriggerKeyDown}
      >
        <span className={selected ? styles.value : `${styles.value} ${styles.placeholder}`}>
          {selected ? selected.label : placeholder}
        </span>
        <svg className={styles.chev} width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M3.2 6.1c1.6 1.4 3.1 3 4.7 4.4 1.7-1.5 3.2-3.1 4.9-4.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <div
        ref={popRef}
        id={popId}
        popover="auto"
        className={styles.pop}
        onToggle={onToggle}
        // 点选项不让触发器 / 搜索框失焦
        onMouseDown={(e) => {
          if (e.target !== searchRef.current) e.preventDefault();
        }}
      >
        {searchable ? (
          <input
            ref={searchRef}
            type="text"
            className={styles.search}
            value={query}
            placeholder={searchPlaceholder}
            role="combobox"
            aria-label={searchPlaceholder}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 && activePos >= 0 ? optId(active) : undefined}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => {
              const q = e.target.value;
              setQuery(q);
              const next = filterOptions(options, q);
              const sel = next.find((i) => i === selectedIndex && !options[i].disabled);
              setActive(sel ?? next.find((i) => !options[i].disabled) ?? -1);
            }}
            onKeyDown={onSearchKeyDown}
          />
        ) : null}
        <ScrollArea
          ref={listRef}
          className={styles.listRoot}
          viewportClassName={styles.list}
          id={listId}
          role="listbox"
          aria-labelledby={ariaLabelledBy}
          aria-label={ariaLabelledBy ? undefined : ariaLabel ?? placeholder}
        >
          {visible.map((i) => {
            const o = options[i];
            return (
              <div
                key={`${i}:${o.value}`}
                id={optId(i)}
                role="option"
                className={styles.option}
                aria-selected={i === selectedIndex}
                aria-disabled={o.disabled || undefined}
                data-active={i === active || undefined}
                onPointerMove={() => !o.disabled && i !== active && setActive(i)}
                onClick={() => commit(i)}
              >
                <svg className={styles.check} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <path d="M2.2 7.4c1.2 1 2.2 2.1 3.3 3.2 2-2.7 4-5.2 6.3-7.6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={styles.label}>{searchable ? <Highlight text={o.label} query={query} /> : o.label}</span>
                {o.hint ? <span className={styles.hint}>{o.hint}</span> : null}
              </div>
            );
          })}
          {visible.length === 0 ? <div className={styles.empty}>{emptyText}</div> : null}
        </ScrollArea>
      </div>

      {/* 表单代理：提交 / required 校验 / reset 走原生；校验失败时把焦点交给触发器并标红 */}
      <select
        ref={nativeRef}
        className={styles.native}
        name={name}
        value={current}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        onChange={() => {}}
        onInvalid={() => setNativeInvalid(true)}
        onFocus={() => triggerRef.current?.focus()}
      >
        {/* 当前值不在选项里（含占位 ""）时补一个空 option：放在首位，满足 required 的占位规则 */}
        {selectedIndex < 0 ? <option value={current} /> : null}
        {options.map((o, i) => (
          <option key={`${i}:${o.value}`} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 搜索命中的片段加粗高亮（只标第一处，忽略大小写） */
function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const at = q ? text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase()) : -1;
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.mark}>{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  );
}
