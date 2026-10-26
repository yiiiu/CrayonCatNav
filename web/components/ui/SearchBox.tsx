"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { moveActive, normalizeQuery, parseSuggest, type SuggestResult } from "@/lib/ui/live-search";
import { buildSearchHref } from "@/lib/validation/search";
import styles from "./SearchBox.module.css";

type Props = {
  action?: string;
  defaultValue?: string;
  placeholder?: string;
  /** 需要随搜索一起保留的其他条件（如 cat、tag） */
  hidden?: Record<string, string | undefined>;
  className?: string;
  /**
   * 实时模式：
   * - filter：边输入边更新当前列表（防抖后 router.replace 改 ?q=，保留分类 / 标签）；
   * - suggest：边输入边在下拉里展示匹配资源，回车或「查看全部」进入列表页。
   * 不传则是普通 GET 表单。无 JS 时两种模式都退化为 GET 表单提交。
   */
  live?: "filter" | "suggest";
};

const FILTER_DELAY = 250;
const SUGGEST_DELAY = 180;

export function SearchBox({ action = "/resources", defaultValue, placeholder = "搜索 MCP、Agent、模型…", hidden, className, live }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const composing = useRef(false);
  const lastQ = useRef(normalizeQuery(defaultValue));
  const abort = useRef<AbortController | null>(null);
  const [pending, startTransition] = useTransition();

  const listId = useId();
  const [result, setResult] = useState<SuggestResult | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);

  // URL 被别处改动（如点「关键词 ×」清空）时，未聚焦的输入框跟着同步
  useEffect(() => {
    const q = normalizeQuery(defaultValue);
    lastQ.current = q;
    const el = inputRef.current;
    if (el && document.activeElement !== el) el.value = defaultValue ?? "";
  }, [defaultValue]);

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      abort.current?.abort();
    },
    [],
  );

  const listHref = (q: string) => buildSearchHref({ cat: hidden?.cat, tag: hidden?.tag }, { q: q || undefined }, action);

  function applyFilter(raw: string) {
    const q = normalizeQuery(raw);
    if (q === lastQ.current) return;
    lastQ.current = q;
    startTransition(() => router.replace(listHref(q), { scroll: false }));
  }

  async function fetchSuggest(raw: string) {
    const q = normalizeQuery(raw);
    abort.current?.abort();
    if (!q) {
      setResult(null);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    abort.current = ctrl;
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
      const data = parseSuggest(await res.json());
      if (ctrl.signal.aborted) return;
      setResult(data ?? { q, total: 0, items: [] });
      setActive(-1);
      setOpen(true);
    } catch {
      if (!ctrl.signal.aborted) setResult(null);
    } finally {
      if (!ctrl.signal.aborted) setLoading(false);
    }
  }

  function schedule(raw: string) {
    if (!live || composing.current) return; // 中文输入法组字过程中不触发
    clearTimeout(timer.current);
    if (live === "filter") timer.current = setTimeout(() => applyFilter(raw), FILTER_DELAY);
    else timer.current = setTimeout(() => void fetchSuggest(raw), SUGGEST_DELAY);
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!live) return;
    e.preventDefault();
    clearTimeout(timer.current);
    const raw = inputRef.current?.value ?? "";
    if (live === "filter") return applyFilter(raw);
    // 点「查看全部」时忽略高亮项，直接进列表页
    const toAll = (e.nativeEvent as SubmitEvent).submitter?.dataset.all === "1";
    const item = !toAll && active >= 0 ? result?.items[active] : undefined;
    setOpen(false);
    router.push(item ? `/resources/${item.slug}` : listHref(normalizeQuery(raw)));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (live !== "suggest" || e.nativeEvent.isComposing) return;
    const count = result?.items.length ?? 0;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (!open && result) {
        setOpen(true);
        e.preventDefault();
        return;
      }
      if (!count) return;
      e.preventDefault();
      setActive((a) => moveActive(count, a, e.key === "ArrowDown" ? 1 : -1));
    } else if (e.key === "Escape" && open) {
      e.preventDefault(); // 先关下拉，再按一次才清空输入框
      setOpen(false);
      setActive(-1);
    }
  }

  const showList = live === "suggest" && open && !!result;
  const activeId = showList && active >= 0 ? `${listId}-${active}` : undefined;

  return (
    <form
      action={action}
      role="search"
      className={`${styles.form} ${className ?? ""}`}
      onSubmit={onSubmit}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className={styles.srch} aria-busy={pending || loading || undefined}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="M15.5 15.5 21 21" />
        </svg>
        <span className="sr-only">搜索资源</span>
        <input
          ref={inputRef}
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxLength={50}
          autoComplete="off"
          {...(live === "suggest"
            ? {
                role: "combobox",
                "aria-autocomplete": "list" as const,
                "aria-expanded": showList,
                "aria-controls": listId,
                "aria-activedescendant": activeId,
              }
            : {})}
          onChange={(e) => schedule(e.currentTarget.value)}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={(e) => {
            composing.current = false;
            schedule(e.currentTarget.value);
          }}
          onKeyDown={onKeyDown}
          onFocus={() => {
            if (live === "suggest" && result && normalizeQuery(inputRef.current?.value) === result.q) setOpen(true);
          }}
        />
        {(pending || loading) && <span className={styles.spin} aria-hidden="true" />}
        {hidden &&
          Object.entries(hidden).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      </label>

      {live === "suggest" && (
        <div className={styles.pop} hidden={!showList}>
          <ul id={listId} role="listbox" aria-label="搜索联想" className={styles.list}>
            {result?.items.map((it, i) => (
              <li
                key={it.slug}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                className={styles.opt}
                onMouseDown={(e) => e.preventDefault()} // 保持输入框焦点
                onMouseEnter={() => setActive(i)}
                onClick={() => {
                  setOpen(false);
                  router.push(`/resources/${it.slug}`);
                }}
              >
                <span className={styles.optName}>{it.name}</span>
                <span className={styles.optCat}>{it.category}</span>
                {it.summary && <span className={styles.optSum}>{it.summary}</span>}
              </li>
            ))}
          </ul>
          {result && result.items.length === 0 ? (
            <p className={styles.empty}>没找到「{result.q}」相关资源，换个关键词试试</p>
          ) : (
            result && (
              <button type="submit" data-all="1" className={styles.all} onMouseDown={(e) => e.preventDefault()}>
                查看全部 {result.total} 条结果 ›
              </button>
            )
          )}
        </div>
      )}
    </form>
  );
}
