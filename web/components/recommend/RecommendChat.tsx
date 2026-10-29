"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Mono } from "@/components/ui";
import { isToolSlug } from "@/lib/tools/metas";
import { deriveToolPrefill } from "@/lib/tools/prefill";
import { getTool } from "@/lib/tools/registry";
import styles from "./RecommendChat.module.css";

/**
 * 全站右下角的「AI 推荐」气泡（规格 docs/spec/前台推荐Agent方案.md §2）。
 * 参考 assistant-ui AssistantModal / CopilotKit CopilotPopup：角落浮动按钮 → 弹出对话面板（欢迎语 + 示例问题 + 消息流 + 输入框），
 * 打开时按钮变成 ×；Esc 或点面板外关闭；手机上全屏。
 * 每次提问独立（后端一问一答），面板里的记录只存在当前页面内存，不写 URL / 本地存储 / 埋点。
 */

type Item = {
  slug: string;
  name: string;
  summary: string;
  category: { slug: string; name: string };
  tools: string[];
  reason: string;
};
type Reply =
  | { ok: true; mode: "ai" | "fallback"; items: Item[]; note?: string; notice?: string }
  | { ok: false; code: string; message: string };
type Turn = { id: number; q: string; reply: Reply | null };

const EXAMPLES = ["把 Claude 接到本地文件", "免费开源的大模型", "做 PPT 的 AI"];
const MAX = 200;
const CLIENT_TIMEOUT_MS = 25_000;
const MAX_TURNS = 10;

function toolLinks(item: Item) {
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

function ResultItem({ item, onNavigate }: { item: Item; onNavigate: () => void }) {
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
      <p className={styles.reason}>{item.reason || item.summary}</p>
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

function AssistantReply({ reply, onNavigate }: { reply: Reply; onNavigate: () => void }) {
  if (!reply.ok) return <div className={`${styles.bubble} ${styles.bot} ${styles.err}`}>{reply.message}</div>;
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
  const [turns, setTurns] = useState<Turn[]>([]);
  const [loading, setLoading] = useState(false);
  const panelId = useId();
  const titleId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);
  const seq = useRef(0);

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  // 打开时聚焦输入框；Esc 关闭；点面板外关闭
  useEffect(() => {
    if (!open) return;
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
  }, [open, close]);

  useEffect(() => () => abort.current?.abort(), []);

  // 新消息滚到底
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, loading, open]);

  async function ask(text: string) {
    const v = text.trim();
    if (v.length < 2 || loading) return;
    const id = ++seq.current;
    setTurns((t) => [...t, { id, q: v, reply: null }].slice(-MAX_TURNS));
    setQ("");
    setLoading(true);
    const ctl = new AbortController();
    abort.current = ctl;
    const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
    let reply: Reply;
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: v }),
        signal: ctl.signal,
        cache: "no-store",
      });
      reply = (await res.json()) as Reply;
    } catch {
      reply = { ok: false, code: "network", message: "网络有点慢，没等到结果，请再试一次" };
    } finally {
      clearTimeout(timer);
    }
    setTurns((t) => t.map((x) => (x.id === id ? { ...x, reply } : x)));
    setLoading(false);
    inputRef.current?.focus();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(q);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 发送，Shift+Enter 换行；输入法组字中不发送
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(q);
    }
  }

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
            {turns.length > 0 && (
              <button type="button" className={styles.iconBtn} onClick={() => setTurns([])} disabled={loading} title="清空记录">
                清空
              </button>
            )}
            <button type="button" className={styles.iconBtn} onClick={() => close()} aria-label="关闭">
              ✕
            </button>
          </header>

          <div ref={logRef} className={styles.log} aria-live="polite" aria-busy={loading}>
            <div className={`${styles.bubble} ${styles.bot}`}>
              <p>喵～说说你想做什么，我从本站资源里给你挑几个，并说说为什么。</p>
              {turns.length === 0 && (
                <div className={styles.examples}>
                  {EXAMPLES.map((x) => (
                    <button key={x} type="button" className={styles.example} onClick={() => void ask(x)} disabled={loading}>
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
                  <AssistantReply reply={t.reply} onNavigate={() => close(false)} />
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
          </div>

          <form className={styles.composer} onSubmit={onSubmit}>
            <textarea
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value.slice(0, MAX))}
              onKeyDown={onKeyDown}
              maxLength={MAX}
              rows={2}
              placeholder="比如：让 Claude 读写我的 Notion"
              aria-label="描述你的需求"
            />
            <div className={styles.composerFoot}>
              <small>
                描述会发给第三方模型，本站不保存 · {q.length}/{MAX}
              </small>
              <button type="submit" className={styles.send} disabled={loading || q.trim().length < 2} aria-label="发送">
                ↑
              </button>
            </div>
          </form>
        </div>
      )}

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
