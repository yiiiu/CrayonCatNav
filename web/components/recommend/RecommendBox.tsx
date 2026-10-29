"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ResourceCard, type ResourceCardView } from "@/components/resource/ResourceCard";
import { Button, Card } from "@/components/ui";
import { isToolSlug } from "@/lib/tools/metas";
import { deriveToolPrefill } from "@/lib/tools/prefill";
import { getTool } from "@/lib/tools/registry";
import styles from "./RecommendBox.module.css";

/**
 * 首页「AI 推荐」（规格 docs/spec/前台推荐Agent方案.md §2）。
 * 输入只随 POST 请求体发送，不进 URL、不进埋点；结果原位显示。
 */

type Item = ResourceCardView & { tools: string[]; reason: string };
type Result =
  | { ok: true; mode: "ai" | "fallback"; items: Item[]; note?: string; notice?: string }
  | { ok: false; code: string; message: string; retryAfterSec?: number };

const EXAMPLES = ["把 Claude 接到本地文件", "免费开源的大模型", "做 PPT 的 AI"];
const MAX = 200;
const CLIENT_TIMEOUT_MS = 25_000;

function ToolLinks({ item }: { item: Item }) {
  const links = item.tools.flatMap((slug) => {
    const tool = getTool(slug);
    if (!tool || tool.defaultStatus === "hidden") return [];
    let href = `/tools/${tool.slug}`;
    if (isToolSlug(tool.slug)) {
      const qs = deriveToolPrefill(tool.slug, { slug: item.slug, name: item.name, summary: item.summary, categorySlug: item.category.slug }).toString();
      if (qs) href += `?${qs}`;
    }
    return [{ href, name: tool.name }];
  });
  if (!links.length) return null;
  return (
    <div className={styles.tools}>
      {links.map((l) => (
        <Link key={l.href} href={l.href}>
          打开{l.name} →
        </Link>
      ))}
    </div>
  );
}

export function RecommendBox() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const abort = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  async function ask(text: string) {
    const v = text.trim();
    if (v.length < 2 || loading) return;
    abort.current?.abort();
    const ctl = new AbortController();
    abort.current = ctl;
    const timer = setTimeout(() => ctl.abort(), CLIENT_TIMEOUT_MS);
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/recommend", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ q: v }),
        signal: ctl.signal,
        cache: "no-store",
      });
      const data = (await res.json()) as Result;
      setResult(data);
    } catch {
      if (abort.current === ctl) setResult({ ok: false, code: "network", message: "网络有点慢，没等到结果，请再试一次" });
    } finally {
      clearTimeout(timer);
      if (abort.current === ctl) setLoading(false);
    }
  }

  useEffect(() => {
    if (result) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(q);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter 提交，Shift+Enter 换行；输入法组字中不提交
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void ask(q);
    }
  }

  return (
    <section aria-labelledby="h-rec" className={styles.wrap}>
      <Card className={styles.box}>
        <h2 id="h-rec" className={styles.title}>
          ✨ 不知道搜什么？说说你想做什么
        </h2>
        <form onSubmit={onSubmit} className={styles.form}>
          <textarea
            className={styles.input}
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, MAX))}
            onKeyDown={onKeyDown}
            maxLength={MAX}
            rows={2}
            placeholder="比如：我想让 Claude 读写我的 Notion 笔记"
            aria-label="描述你的需求"
          />
          <div className={styles.row}>
            <div className={styles.examples} aria-label="示例">
              {EXAMPLES.map((x) => (
                <button
                  key={x}
                  type="button"
                  className={styles.example}
                  onClick={() => {
                    setQ(x);
                    void ask(x);
                  }}
                  disabled={loading}
                >
                  {x}
                </button>
              ))}
            </div>
            <span className={styles.count}>
              {q.length}/{MAX}
            </span>
            <Button type="submit" variant="primary" disabled={loading || q.trim().length < 2}>
              {loading ? "思考中…" : "帮我挑"}
            </Button>
          </div>
          <p className={styles.privacy}>你的描述会发给第三方模型服务生成推荐，本站不保存。</p>
        </form>
      </Card>

      <div ref={resultRef} aria-live="polite" aria-busy={loading}>
        {loading && (
          <p className={styles.loading}>
            <span className={styles.dots} aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            蜡笔猫正在翻资源…
          </p>
        )}
        {result && !result.ok && (
          <p className={styles.msg} role="alert">
            {result.message}
          </p>
        )}
        {result?.ok && (
          <>
            {result.notice && <p className={styles.msg}>{result.notice}</p>}
            {result.note && <p className={styles.note}>{result.note}</p>}
            {result.items.length === 0 ? (
              <p className={styles.msg}>
                本站暂时没有特别合适的资源。可以换个说法，或者 <Link href="/resources">看看全部资源</Link>。
              </p>
            ) : (
              <div className={styles.grid}>
                {result.items.map((it) => (
                  <div key={it.slug} className={styles.item}>
                    <ResourceCard r={it} />
                    {it.reason && <p className={styles.reason}>{it.reason}</p>}
                    <ToolLinks item={it} />
                  </div>
                ))}
              </div>
            )}
            {result.items.length > 0 && (
              <p className={styles.more}>
                没找到想要的？<Link href="/resources">去搜索 / 看全部分类 ›</Link>
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
