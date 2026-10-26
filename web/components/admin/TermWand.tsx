"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, useTransition } from "react";
import { Loader2, WandSparkles } from "lucide-react";
import type { ActionResult } from "@/lib/domain/result";
import { FIELD_LIMITS, splitFieldValue, type ClassifiedTerm, type TermField } from "@/lib/agent/term-rules";
import a from "./agent.module.css";

/** 表单当前值（含未保存的），传给服务端做语境。 */
export type WandDraft = Partial<Record<TermField | "description" | "githubNewMinStars", string>>;
export type SuggestTermsFn = (field: TermField, draft: WandDraft) => Promise<ActionResult<{ items: ClassifiedTerm[]; checked: boolean; version: string }>>;
export type SuggestDescriptionFn = (draft: WandDraft) => Promise<ActionResult<string>>;

const DRAFT_KEYS = ["githubTopics", "githubKeywords", "hfSearch", "description", "githubNewMinStars"] as const;

function readDraft(form: HTMLFormElement | null): WandDraft {
  const fd = form ? new FormData(form) : null;
  return Object.fromEntries(DRAFT_KEYS.map((k) => [k, (fd?.get(k) ?? "").toString()]));
}

/** 改非受控输入框的值并派发 input 事件（让依赖 input 事件的逻辑感知到变化）。 */
function setFieldValue(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

function hitsText(t: ClassifiedTerm, field: TermField, minStars: number): string {
  if (t.hits === null) return "命中：未校验（GitHub 无 Token 时只校验前 8 个，或接口暂时不可用）";
  if (field === "hfSearch") return `命中：HF 约 ${t.hitsCapped ? "100+" : t.hits} 个 Space`;
  return `命中：GitHub 约 ${t.hits.toLocaleString("zh-CN")} 个仓库（star ≥ ${minStars}）`;
}

const STATUS_LABEL = { ok: "推荐", broad: "过泛", blocked: "不可用" } as const;

/** 弹层打开后测量位置：超出所在表单（没有表单则视口）右边界时向左平移，避免被裁切。直接写 DOM，不经 state。 */
function useKeepInside(open: boolean, popRef: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  useLayoutEffect(() => {
    const pop = popRef.current;
    if (!open || !pop) return;
    const measure = () => {
      pop.style.transform = "";
      const anchor = pop.offsetParent as HTMLElement | null;
      const bound = pop.closest("form") ?? document.documentElement;
      const box = bound.getBoundingClientRect();
      const right = Math.min(box.right, document.documentElement.clientWidth) - 8;
      const left = Math.max(box.left, 0) + 8;
      const anchorLeft = anchor?.getBoundingClientRect().left ?? 0;
      const width = pop.offsetWidth;
      let shift = 0;
      if (anchorLeft + width > right) shift = right - width - anchorLeft;
      if (anchorLeft + shift < left) shift = left - anchorLeft;
      pop.style.transform = shift ? `translateX(${shift}px)` : "";
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, popRef, ...deps]);
}

function WandIcon({ pending }: { pending: boolean }) {
  return pending ? <Loader2 size={16} strokeWidth={2.5} className={a.wandSpin} aria-hidden /> : <WandSparkles size={16} strokeWidth={2.5} aria-hidden />;
}

/** 关闭弹层：点外面或按 Esc。 */
function useDismiss(open: boolean, ref: React.RefObject<HTMLElement | null>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, close]);
}

/** 关键词字段的魔法棒：AI 给候选词，悬浮看语义 / 理由 / 命中，点选加入输入框（不自动保存）。 */
export function TermWand({ field, inputId, suggest }: { field: TermField; inputId: string; suggest: SuggestTermsFn }) {
  const ref = useRef<HTMLSpanElement>(null);
  const tipBase = useId();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [items, setItems] = useState<ClassifiedTerm[]>([]);
  const [minStars, setMinStars] = useState(100);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const popRef = useRef<HTMLDivElement>(null);
  useKeepInside(open, popRef, [pending, items.length, error, notice]);
  useDismiss(open, ref, () => setOpen(false));

  const input = () => document.getElementById(inputId) as HTMLInputElement | null;

  const run = () => {
    const el = input();
    const draft = readDraft(el?.form ?? null);
    setOpen(true);
    setError("");
    setNotice("");
    setMinStars(Math.max(0, Number(draft.githubNewMinStars) || 100));
    start(async () => {
      const r = await suggest(field, draft);
      if (!r.ok) {
        setItems([]);
        setError(r.formError ?? "生成失败");
        return;
      }
      setItems(r.data?.items ?? []);
      setAdded(new Set());
    });
  };

  /** 追加若干词，返回实际加入的。 */
  const addTerms = (terms: string[]) => {
    const el = input();
    if (!el) return [];
    const current = splitFieldValue(field, el.value);
    const lower = new Set(current.map((t) => t.toLowerCase()));
    const room = FIELD_LIMITS[field] - current.length;
    const fresh = terms.filter((t) => !lower.has(t.toLowerCase())).slice(0, Math.max(0, room));
    if (fresh.length) setFieldValue(el, [...current, ...fresh].join(", "));
    setAdded((s) => new Set([...s, ...fresh]));
    const skipped = terms.length - fresh.length;
    setNotice(room <= 0 ? `已达上限 ${FIELD_LIMITS[field]} 个，先删一个再加` : skipped > 0 ? `已加入 ${fresh.length} 个，其余超出上限 ${FIELD_LIMITS[field]} 个` : fresh.length ? "已加入输入框，记得点「保存配置」" : "");
    return fresh;
  };

  const okTerms = items.filter((t) => t.status === "ok" && !added.has(t.term)).map((t) => t.term);

  return (
    <span className={a.wand} ref={ref}>
      <button type="button" className={a.wandBtn} onClick={run} disabled={pending} aria-expanded={open} aria-label="AI 推荐关键词" title="AI 推荐关键词">
        <WandIcon pending={pending} />
      </button>
      {open && (
        <div ref={popRef} className={a.wandPop} role="dialog" aria-label="AI 推荐关键词">
          {pending && <p className={a.wandMsg}>正在生成并校验命中数，约 10–40 秒…</p>}
          {!pending && error && <p className={a.wandErr} role="alert">{error}</p>}
          {!pending && !error && items.length === 0 && <p className={a.wandMsg}>没有可推荐的新词</p>}
          {!pending && items.length > 0 && (
            <>
              <ul className={a.wandChips}>
                {items.map((t, i) => {
                  const tipId = `${tipBase}-${i}`;
                  const done = added.has(t.term);
                  return (
                    <li key={t.term} className={a.wandItem}>
                      <button
                        type="button"
                        className={`${a.chip} ${a[`chip_${t.status}`]} ${done ? a.chipDone : ""}`}
                        disabled={t.status === "blocked" || done}
                        aria-describedby={tipId}
                        onClick={() => addTerms([t.term])}
                      >
                        {done ? "✓ " : ""}
                        {t.term}
                      </button>
                      <span role="tooltip" id={tipId} className={a.tip}>
                        <b>
                          {t.term} · {STATUS_LABEL[t.status]}
                        </b>
                        {t.meaning && <span>语义：{t.meaning}</span>}
                        {t.reason && <span>理由：{t.reason}</span>}
                        <span>{hitsText(t, field, minStars)}</span>
                        {t.note && t.status !== "ok" && <span className={a.tipNote}>{t.note}</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className={a.wandFoot}>
                <button type="button" className={a.wandAll} disabled={okTerms.length === 0} onClick={() => addTerms(okTerms)}>
                  全部加入推荐
                </button>
                <span className={a.wandLegend}>
                  <i className={a.chip_ok} />推荐 <i className={a.chip_broad} />过泛 <i className={a.chip_blocked} />不可用
                </span>
              </div>
            </>
          )}
          {notice && <p className={a.wandMsg} role="status">{notice}</p>}
        </div>
      )}
    </span>
  );
}

/** 分类说明的魔法棒：生成一版草稿，预览后点「替换」才写进输入框（不自动保存）。 */
export function DescriptionWand({ inputId, suggest }: { inputId: string; suggest: SuggestDescriptionFn }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [hasOld, setHasOld] = useState(false);
  const popRef = useRef<HTMLDivElement>(null);
  useKeepInside(open, popRef, [pending, text, error]);
  useDismiss(open, ref, () => setOpen(false));

  const el = () => document.getElementById(inputId) as HTMLTextAreaElement | null;

  const run = () => {
    const t = el();
    const draft = readDraft(t?.form ?? null);
    setHasOld(!!t?.value.trim());
    setOpen(true);
    setError("");
    start(async () => {
      const r = await suggest(draft);
      if (!r.ok) {
        setText("");
        setError(r.formError ?? "生成失败");
        return;
      }
      setText(r.data ?? "");
    });
  };

  const apply = () => {
    const t = el();
    if (t) setFieldValue(t, text);
    setOpen(false);
  };

  return (
    <span className={a.wand} ref={ref}>
      <button type="button" className={a.wandBtn} onClick={run} disabled={pending} aria-expanded={open} aria-label="AI 生成分类说明" title="AI 生成分类说明">
        <WandIcon pending={pending} />
      </button>
      {open && (
        <div ref={popRef} className={a.wandPop} role="dialog" aria-label="AI 生成分类说明">
          {pending && <p className={a.wandMsg}>正在生成分类说明…</p>}
          {!pending && error && <p className={a.wandErr} role="alert">{error}</p>}
          {!pending && text && (
            <>
              <p className={a.wandDraft}>{text}</p>
              <div className={a.wandFoot}>
                <button type="button" className={a.wandAll} onClick={apply}>
                  {hasOld ? "替换现有说明" : "填入说明"}
                </button>
                <button type="button" className={a.wandGhost} onClick={() => setOpen(false)}>
                  不用了
                </button>
              </div>
              {hasOld && <p className={a.wandMsg}>替换后原说明会被覆盖；不满意可不保存，刷新页面即恢复。</p>}
            </>
          )}
        </div>
      )}
    </span>
  );
}
