"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ConfirmDialog, Mono, ScrollArea } from "@/components/ui";
import {
  contextOf,
  INPUT_KEY,
  load,
  parseInputs,
  parseStored,
  pushInput,
  save,
  serializeTurns,
  stepHistory,
  STORE_KEY,
  MAX_TURNS,
  cleanReply,
  type RecItem,
  type RecReply,
  type RecTurn,
} from "@/lib/recommend/history";
import { isToolSlug } from "@/lib/tools/metas";
import { deriveToolPrefill } from "@/lib/tools/prefill";
import { getTool } from "@/lib/tools/registry";
import styles from "./RecommendChat.module.css";

/**
 * 全站右下角的「AI 推荐」气泡（规格 docs/spec/前台推荐Agent方案.md §2）。
 * 参考 assistant-ui AssistantModal / CopilotKit CopilotPopup：角落浮动按钮 → 弹出对话面板（欢迎语 + 示例问题 + 消息流 + 输入框），
 * 打开时按钮变成 ×；Esc 或点面板外关闭；手机上全屏。
 * - 对话与输入历史存在访客自己的 localStorage（lib/recommend/history.ts），本站服务器不保存。
 * - 追问：请求带上最近 2 轮的问题与推荐过的资源，服务端同样不落库。
 * - 生成中可停止；失败的轮次可重试；输入框 ↑/↓ 翻看最近 20 条发过的问题。
 */

const EXAMPLES = ["把 Claude 接到本地文件", "免费开源的大模型", "做 PPT 的 AI"];
const MAX = 200;
const CLIENT_TIMEOUT_MS = 25_000;
const isBrowser = () => typeof window !== "undefined";

function toolLinks(item: RecItem) {
  return item.tools.flatMap((slug) => {
    const tool = getTool(slug);
    if (!tool || tool.defaultStatus === "hidden") return [];
    let href = `/tools/${tool.slug}`;
    if (isToolSlug(tool.slug)) {
      const qs = deriveToolPrefill(tool.slug, { slug: item.slug, name: item.name, summary: item.summary, categorySlug: item.category.slug }).toString();
      if (qs) href += `?${qs}`;
    }
    return [{ href, name: tool.name }];
  });
}

function ResultItem({ item, onNavigate }: { item: RecItem; onNavigate: () => void }) {
  const tools = toolLinks(item);
  return (
    <li className={styles.res}>
      <Link href={`/resources/${item.slug}`} className={styles.resMain} onClick={onNavigate}>
        <Mono name={item.name} accentKey={item.category.slug + item.slug} />
        <span className={styles.resText}>
          <b>{item.name}</b>
          <small>{item.category.name}</small>
        </span>
        <span className={styles.go} aria-hidden="true">
          ›
        </span>
      </Link>
      {(item.reason || item.summary) && <p className={styles.reason}>{item.reason || item.summary}</p>}
      {tools.length > 0 && (
        <div className={styles.tools}>
          {tools.map((t) => (
            <Link key={t.href} href={t.href} onClick={onNavigate}>
              打开{t.name} →
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}

function AssistantReply({ reply, onNavigate, onRetry }: { reply: RecReply; onNavigate: () => void; onRetry?: () => void }) {
  if (!reply.ok)
    return (
      <div className={`${styles.bubble} ${styles.bot} ${reply.code === "aborted" ? styles.muted : styles.err}`}>
        <span>{reply.message}</span>
        {onRetry && reply.code !== "rate_limited" && reply.code !== "invalid_input" && (
          <button type="button" className={styles.retry} onClick={onRetry}>
            重试
          </button>
        )}
      </div>
    );
  return (
    <div className={`${styles.bubble} ${styles.bot}`}>
      {reply.notice && <p className={styles.notice}>{reply.notice}</p>}
      {reply.items.length === 0 ? (
        <p>
          本站暂时没有特别合适的资源，换个说法试试，或者
          <Link href="/resources" onClick={onNavigate}>
            看看全部资源
          </Link>
          。
        </p>
      ) : (
        <>
          {!reply.notice && <p>{reply.note || `给你挑了 ${reply.items.length} 个：`}</p>}
          <ul className={styles.results}>
            {reply.items.map((it) => (
              <ResultItem key={it.slug} item={it} onNavigate={onNavigate} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function RecommendChat() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  // 面板初始关闭、不渲染对话，所以首帧直接读 localStorage 也不会造成水合不一致
  const [turns, setTurns] = useState<RecTurn[]>(() => (isBrowser() ? load(STORE_KEY, (s) => parseStored(s, Date.now()), []) : []));
  const [inputs, setInputs] = useState<string[]>(() => (isBrowser() ? load(INPUT_KEY, parseInputs, []) : []));
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const loading = loadingId !== null;

  const panelId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const stopped = useRef(false);
  const seq = useRef(turns.length);
  const hist = useRef({ index: inputs.length, draft: "" });
  const dirty = useRef(false);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // 打开时聚焦输入框；Esc 关闭；点面板外关闭（确认弹窗打开时交给弹窗处理）
  useEffect(() => {
    if (!open || confirmClear) return;
    inputRef.current?.focus();
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open, confirmClear, close]);

  useEffect(() => () => abort.current?.abort(), []);

  // 对话变化（由访客操作引起）才写回本地；只是打开页面不刷新过期时间
  useEffect(() => {
    if (!dirty.current) return;
    save(STORE_KEY, turns.some((t) => t.reply) ? serializeTurns(turns, Date.now()) : null);
  }, [turns]);

  // 新消息、打开面板时滚到底
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, loadingId, open]);

  const run = useCallback(async (id: number, text: string, context: ReturnType<typeof contextOf>) => {
    setLoadingId(id);
    stopped.current = false;
    const ctl = new AbortController();
    abort.current = ctl;
    const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
    let reply: RecReply;
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(context.length ? { q: text, context } : { q: text }),
        signal: ctl.signal,
        cache: "no-store",
      });
      reply = cleanReply(await res.json()) ?? { ok: false, code: "error", message: "推荐服务出错了，请稍后再试" };
    } catch {
      reply = stopped.current
        ? { ok: false, code: "aborted", message: "已停止" }
        : { ok: false, code: "network", message: "网络有点慢，没等到结果" };
    } finally {
      clearTimeout(timer);
      abort.current = null;
    }
    dirty.current = true;
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, reply } : x)));
    setLoadingId(null);
    inputRef.current?.focus();
  }, []);

  function ask(text: string) {
    const v = text.trim().replace(/\s+/g, " ");
    if (v.length < 2 || loading) return;
    const id = ++seq.current;
    const context = contextOf(turns);
    dirty.current = true;
    setTurns((t) => [...t, { id, q: v, reply: null }].slice(-MAX_TURNS));
    const nextInputs = pushInput(inputs, v);
    setInputs(nextInputs);
    save(INPUT_KEY, JSON.stringify(nextInputs));
    hist.current = { index: nextInputs.length, draft: "" };
    setQ("");
    void run(id, v, context);
  }

  function retry(turn: RecTurn) {
    if (loading) return;
    const before = turns.slice(0, turns.findIndex((t) => t.id === turn.id));
    setTurns((t) => t.map((x) => (x.id === turn.id ? { ...x, reply: null } : x)));
    void run(turn.id, turn.q, contextOf(before));
  }

  function stop() {
    stopped.current = true;
    abort.current?.abort();
  }

  function clearAll() {
    setConfirmClear(false);
    dirty.current = true;
    setTurns([]);
    setInputs([]);
    save(INPUT_KEY, null);
    hist.current = { index: 0, draft: "" };
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) stop();
    else ask(q);
  }

  function setValueAndCaretEnd(value: string) {
    setQ(value);
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) el.setSelectionRange(value.length, value.length);
    });
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.nativeEvent.isComposing) return; // 输入法组字中：交给输入法
    // Enter 发送，Shift+Enter 换行
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) ask(q);
      return;
    }
    // ↑/↓ 翻看发过的问题：光标在第一行按 ↑、在最后一行按 ↓ 才触发，不影响多行编辑
    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey) {
      const el = e.currentTarget;
      if (el.selectionStart !== el.selectionEnd) return;
      const up = e.key === "ArrowUp";
      const onEdge = up ? !el.value.slice(0, el.selectionStart).includes("\n") : !el.value.slice(el.selectionEnd).includes("\n");
      if (!onEdge) return;
      const h = hist.current;
      if (h.index === inputs.length) h.draft = q;
      const step = stepHistory(inputs, h.index, up ? -1 : 1, h.draft);
      if (!step) return;
      e.preventDefault();
      h.index = step.index;
      setValueAndCaretEnd(step.value);
    }
  }

  const empty = turns.length === 0;

  return (
    <div ref={rootRef} className={styles.root}>
      {open && (
        <div id={panelId} className={styles.panel} role="dialog" aria-modal="false" aria-labelledby={titleId}>
          <header className={styles.head}>
            <Image src="/cat-logo.png" alt="" width={32} height={32} />
            <span className={styles.headText}>
              <b id={titleId}>蜡笔猫帮你挑</b>
              <small>只从本站已收录的资源里推荐</small>
            </span>
            {(!empty || inputs.length > 0) && (
              <button type="button" className={styles.iconBtn} onClick={() => setConfirmClear(true)} disabled={loading} title="清空对话和输入历史">
                清空
              </button>
            )}
            <button type="button" className={styles.iconBtn} onClick={() => close()} aria-label="关闭">
              ✕
            </button>
          </header>

          <ScrollArea ref={logRef} className={styles.logWrap} viewportClassName={styles.log} aria-live="polite" aria-busy={loading}>
            <div className={`${styles.bubble} ${styles.bot}`}>
              <p>喵～说说你想做什么，我从本站资源里给你挑几个，并说说为什么。可以接着追问，比如「还有免费的吗」。</p>
              {empty && (
                <div className={styles.examples}>
                  {EXAMPLES.map((x) => (
                    <button key={x} type="button" className={styles.example} onClick={() => ask(x)} disabled={loading}>
                      {x}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {turns.map((t) => (
              <div key={t.id} className={styles.turn}>
                <div className={`${styles.bubble} ${styles.me}`}>{t.q}</div>
                {t.reply ? (
                  <AssistantReply reply={t.reply} onNavigate={() => close(false)} onRetry={loading ? undefined : () => retry(t)} />
                ) : (
                  <div className={`${styles.bubble} ${styles.bot} ${styles.thinking}`}>
                    <span className={styles.dots} aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    正在翻资源…
                  </div>
                )}
              </div>
            ))}
          </ScrollArea>

          <form className={styles.composer} onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value.slice(0, MAX));
                hist.current = { index: inputs.length, draft: "" };
              }}
              onKeyDown={onKeyDown}
              maxLength={MAX}
              rows={2}
              placeholder={inputs.length ? "说说你的需求（↑ 翻看发过的问题）" : "比如：让 Claude 读写我的 Notion"}
              aria-label="描述你的需求"
            />
            <div className={styles.composerFoot}>
              <small>
                描述会发给第三方模型；记录只存在你的浏览器 · {q.length}/{MAX}
              </small>
              {loading ? (
                <button type="submit" className={`${styles.send} ${styles.stop}`} aria-label="停止">
                  ■
                </button>
              ) : (
                <button type="submit" className={styles.send} disabled={q.trim().length < 2} aria-label="发送">
                  ↑
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={confirmClear}
        title="清空记录"
        message="会删除本机保存的对话和输入历史，无法恢复。"
        confirmText="清空"
        onConfirm={clearAll}
        onCancel={() => {
          setConfirmClear(false);
          inputRef.current?.focus();
        }}
      />

      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${open ? styles.triggerOpen : ""}`}
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={open ? "关闭 AI 推荐" : "打开 AI 推荐：说说你想做什么"}
      >
        {open ? (
          <span className={styles.x} aria-hidden="true">
            ✕
          </span>
        ) : (
          <>
            <Image src="/cat-logo.png" alt="" width={44} height={44} />
            <span className={styles.spark} aria-hidden="true">
              ✨
            </span>
          </>
        )}
      </button>
    </div>
  );
}
