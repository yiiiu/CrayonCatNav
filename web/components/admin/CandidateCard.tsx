"use client";

import { useActionState } from "react";
import { Button, ConfirmButton } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import styles from "./admin.module.css";
import a from "./agent.module.css";
import { Field } from "./Field";

export type CandidateView = {
  id: string;
  status: "pending" | "published" | "drafted" | "rejected";
  sourceLabel: string;
  sourceUrl: string;
  name: string;
  slug: string;
  summary: string;
  description: string;
  categorySlug: string;
  categoryName: string | null;
  tags: string[];
  websiteUrl: string | null;
  githubUrl: string | null;
  pricingLabel: string;
  toolSlugs: string[];
  reason: string;
  confidence: number;
  stars: number | null;
  sourceUpdatedAt: string | null;
  rawSummary: string;
  createdAt: string;
  resource: { id: string; slug: string; status: string } | null;
};

type Props = {
  c: CandidateView;
  categories: { slug: string; name: string }[];
  review: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  reject: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
};

const confClass = (v: number) => (v >= 0.75 ? a.confHi : v >= 0.5 ? a.confMid : a.confLo);

function ExtLink({ href, children }: { href: string; children: React.ReactNode }) {
  return /^https:\/\//.test(href) ? (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ) : (
    <span>{children}</span>
  );
}

/** 候选卡片：待审核时可改名称 / slug / 简介 / 分类 / 标签后「直接上架」或「存为草稿并编辑」，或「拒绝」。 */
export function CandidateCard({ c, categories, review, reject }: Props) {
  const [state, formAction, pending] = useActionState(review, { ok: true } as ActionResult);
  const [rState, rejectAction, rPending] = useActionState(reject, { ok: true } as ActionResult);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const v = (k: string, fallback: string) => (!state.ok && typeof state.values?.[k] === "string" ? (state.values[k] as string) : fallback);
  const busy = pending || rPending;
  const formError = !state.ok ? state.formError : !rState.ok ? rState.formError : undefined;

  return (
    <article className={a.cand} aria-labelledby={`cand-${c.id}`}>
      <div className={a.candHead}>
        <span className={a.src}>{c.sourceLabel}</span>
        <h2 id={`cand-${c.id}`}>{c.name}</h2>
        <span className={`${a.conf} ${confClass(c.confidence)}`} title="模型给出的把握程度">
          置信度 {c.confidence.toFixed(2)}
        </span>
      </div>
      <div className={a.meta}>
        <span>分类：{c.categoryName ?? `${c.categorySlug}（不存在）`}</span>
        <span>定价：{c.pricingLabel}</span>
        {c.stars !== null && <span>★ {c.stars.toLocaleString("zh-CN")}</span>}
        {c.sourceUpdatedAt && <span>来源更新：{c.sourceUpdatedAt}</span>}
        <span>采集于：{c.createdAt}</span>
      </div>
      <div className={a.meta}>
        {c.websiteUrl && <ExtLink href={c.websiteUrl}>官网 ↗</ExtLink>}
        {c.githubUrl && <ExtLink href={c.githubUrl}>GitHub ↗</ExtLink>}
        <ExtLink href={c.sourceUrl}>来源 ↗</ExtLink>
        {c.resource && (
          <a href={`/admin/resources/${c.resource.id}`}>查看资源（{c.resource.slug}）</a>
        )}
      </div>
      <p className={a.summary}>{c.summary}</p>
      <div>
        {c.tags.map((t) => (
          <span key={t} className={styles.tag}>
            {t}
          </span>
        ))}
        {c.toolSlugs.length > 0 && <span className={styles.hint}> 关联工具：{c.toolSlugs.join("、")}</span>}
      </div>
      {c.reason && <p className={a.reason}>推荐理由：{c.reason}</p>}
      <details className={a.more}>
        <summary>完整介绍与来源原文</summary>
        <p className={a.desc}>{c.description || "（模型未写详细介绍）"}</p>
        {c.rawSummary && <p className={a.raw}>来源原文：{c.rawSummary}</p>}
      </details>

      {c.status === "pending" && (
        <>
          <form action={formAction} className={a.edit} noValidate>
            {formError && (
              <p className={`${styles.alert} ${styles.wide}`} role="alert">
                {formError}
              </p>
            )}
            <Field label="名称" name={`name-${c.id}`} error={err("name")}>
              <input id={`f-name-${c.id}`} name="name" defaultValue={v("name", c.name)} maxLength={80} />
            </Field>
            <Field label="slug" name={`slug-${c.id}`} error={err("slug")}>
              <input id={`f-slug-${c.id}`} name="slug" defaultValue={v("slug", c.slug)} />
            </Field>
            <Field label="简介" name={`summary-${c.id}`} error={err("summary")} wide>
              <input id={`f-summary-${c.id}`} name="summary" defaultValue={v("summary", c.summary)} maxLength={200} />
            </Field>
            <Field label="分类" name={`categorySlug-${c.id}`} error={err("categorySlug")}>
              <select id={`f-categorySlug-${c.id}`} name="categorySlug" defaultValue={v("categorySlug", c.categoryName ? c.categorySlug : "")}>
                <option value="">请选择</option>
                {categories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="标签" name={`tags-${c.id}`} error={err("tags")} hint="逗号分隔；新的中文标签需在 tag-slugs.ts 有映射">
              <input id={`f-tags-${c.id}`} name="tags" defaultValue={v("tags", c.tags.join("，"))} />
            </Field>
            <div className={`${a.acts} ${styles.wide}`}>
              <Button type="submit" variant="primary" name="intent" value="publish" disabled={busy}>
                {pending ? "处理中…" : "直接上架"}
              </Button>
              <Button type="submit" name="intent" value="draft" disabled={busy}>
                存为草稿并编辑
              </Button>
              <ConfirmButton
                className={a.reject}
                formAction={rejectAction}
                disabled={busy}
                title="拒绝候选"
                message={`拒绝「${c.name}」？之后同一链接不会再推送。`}
                confirmText="拒绝"
              >
                {rPending ? "处理中…" : "拒绝"}
              </ConfirmButton>
            </div>
          </form>
        </>
      )}
    </article>
  );
}
