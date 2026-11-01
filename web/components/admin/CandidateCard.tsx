"use client";

import { useActionState } from "react";
import { Button, ConfirmButton, Select } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import { formatTagInput } from "@/lib/validation/tag-vocab";
import styles from "./admin.module.css";
import a from "./agent.module.css";
import btn from "@/components/ui/Button.module.css";
import { Field } from "./Field";
import { PendingButton } from "./PendingButton";

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
  /** 采集时的目标分类（贴链接整理为空） */
  targetName: string | null;
  /** 归入的分类与目标分类不同 */
  offTarget: boolean;
  tags: string[];
  /** 模型建议的新标签（在待定池里） */
  suggestedTags: { name: string; slug: string }[];
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
  /** 审核 Agent 的结论；未审核为 null */
  ai: {
    verdict: "approve" | "reject" | "unsure";
    score: number | null;
    why: string;
    reason: string;
    rules: string[];
    issues: string[];
    applied: string[];
    hasFixes: boolean;
    error?: string;
    by: "human" | "ai" | null;
    at: string | null;
  } | null;
};

type Props = {
  c: CandidateView;
  categories: { slug: string; name: string }[];
  review: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  reject: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  /** 单条 AI 审核 */
  aiReview: () => Promise<void>;
  /** 采纳 AI 建议并上架 */
  adopt: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
  /** 这一条正在后台 AI 审核 */
  aiReviewing?: boolean;
  /** 有 AI 审核任务在跑（同一时间只跑一个） */
  aiBusy?: boolean;
};

const verdictText = { approve: "建议上架", reject: "建议拒绝", unsure: "需人工" } as const;

function AiPanel({ ai }: { ai: NonNullable<CandidateView["ai"]> }) {
  const badge = ai.verdict === "approve" ? a.bApprove : ai.verdict === "reject" ? a.bReject : a.bUnsure;
  return (
    <div className={a.ai}>
      <div className={a.aiHead}>
        <span>AI 审核</span>
        <span className={`${a.badge} ${badge}`}>{verdictText[ai.verdict]}</span>
        {ai.score !== null && <span>{ai.score} 分</span>}
        {ai.by === "ai" && <span className={styles.hint}>已由审核 Agent 自动处理</span>}
        {ai.at && <span className={styles.hint}>{ai.at}</span>}
      </div>
      <p className={a.reason}>{ai.why}</p>
      {ai.reason && ai.reason !== ai.why && <p className={a.reason}>模型理由：{ai.reason}</p>}
      {ai.error && <p className={a.aiErr}>{ai.error}</p>}
      {(ai.rules.length > 0 || ai.issues.length > 0) && (
        <ul className={a.aiList}>
          {ai.rules.map((x) => (
            <li key={`r-${x}`}>{x}</li>
          ))}
          {ai.issues.map((x) => (
            <li key={`i-${x}`}>{x}</li>
          ))}
        </ul>
      )}
      {ai.applied.length > 0 && <p className={styles.hint}>上架时已应用修正：{ai.applied.join("、")}</p>}
    </div>
  );
}

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
export function CandidateCard({ c, categories, review, reject, aiReview, adopt, aiReviewing = false, aiBusy = false }: Props) {
  const [state, formAction, pending] = useActionState(review, { ok: true } as ActionResult);
  const [rState, rejectAction, rPending] = useActionState(reject, { ok: true } as ActionResult);
  const [aState, adoptAction, aPending] = useActionState(adopt, { ok: true } as ActionResult);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);
  const v = (k: string, fallback: string) => (!state.ok && typeof state.values?.[k] === "string" ? (state.values[k] as string) : fallback);
  const busy = pending || rPending || aPending;
  const formError = !state.ok ? state.formError : !rState.ok ? rState.formError : !aState.ok ? aState.formError : undefined;

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
        {c.targetName && (
          <span>
            目标分类：<span className={a.tgt}>{c.targetName}</span>
            {c.offTarget ? "（模型改归其他分类）" : ""}
          </span>
        )}
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
        {c.suggestedTags.map((t) => (
          <span key={t.slug} className={`${styles.tag} ${a.tagNew}`} title={`建议新标签，slug：${t.slug}（在待定池中）`}>
            +{t.name}
          </span>
        ))}
        {c.toolSlugs.length > 0 && <span className={styles.hint}> 关联工具：{c.toolSlugs.join("、")}</span>}
      </div>
      {c.reason && <p className={a.reason}>推荐理由：{c.reason}</p>}
      {aiReviewing ? (
        <p className={a.running} role="status">
          <span className={a.spin} aria-hidden="true" />
          AI 审核中（约 10–30 秒），可以离开本页，完成后这里会自动显示结论
        </p>
      ) : (
        c.ai && <AiPanel ai={c.ai} />
      )}
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
              <Select
                id={`f-categorySlug-${c.id}`}
                name="categorySlug"
                defaultValue={v("categorySlug", c.categoryName ? c.categorySlug : "")}
                invalid={!!err("categorySlug")}
                options={categories.map((cat) => ({ value: cat.slug, label: cat.name }))}
              />
            </Field>
            <Field label="标签" name={`tags-${c.id}`} error={err("tags")} hint="逗号分隔；新标签写成「名字:slug」，如 视频剪辑:video-editing">
              <input id={`f-tags-${c.id}`} name="tags" defaultValue={v("tags", formatTagInput(c.tags, c.suggestedTags))} />
            </Field>
            <div className={`${a.acts} ${styles.wide}`}>
              <Button type="submit" variant="primary" name="intent" value="publish" disabled={busy}>
                {pending ? "处理中…" : "直接上架"}
              </Button>
              <Button type="submit" name="intent" value="draft" disabled={busy}>
                存为草稿并编辑
              </Button>
              {c.ai?.verdict === "approve" && (
                <ConfirmButton
                  className={`${btn.btn} ${a.adopt}`}
                  formAction={adoptAction}
                  disabled={busy}
                  title="采纳 AI 建议"
                  message={c.ai.hasFixes ? "按 AI 的修正（简介 / 分类 / 标签等）更新后直接上架？表单里的手动修改不会生效。" : "按当前内容直接上架？"}
                  confirmText="上架"
                >
                  {aPending ? (
                    <>
                      <span className={a.spin} aria-hidden="true" />
                      上架中…
                    </>
                  ) : (
                    "✨ 采纳 AI 建议"
                  )}
                </ConfirmButton>
              )}
              {aiReviewing ? (
                <Button disabled aria-busy="true">
                  <span className={a.spin} aria-hidden="true" />
                  AI 审核中…
                </Button>
              ) : (
                <PendingButton
                  formAction={aiReview}
                  formNoValidate
                  disabled={busy || aiBusy}
                  title={aiBusy ? "有 AI 审核正在进行，结束后再试" : undefined}
                  label={c.ai ? "重新 AI 审核" : "AI 审核"}
                  pendingLabel="正在启动…"
                />
              )}
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
