"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import { collectSourceHints, collectSourceKeys, collectSourceLabels, type CollectConfig, type CollectSourceKey } from "@/lib/validation/collect-config";
import { DescriptionWand, TermWand, type SuggestDescriptionFn, type SuggestTermsFn } from "./TermWand";
import styles from "./admin.module.css";
import a from "./agent.module.css";

export type CategoryCollectRowView = {
  id: string;
  slug: string;
  name: string;
  published: number;
  pending: number;
  config: CollectConfig | null;
  invalid: boolean;
  active: CollectSourceKey[];
  collectable: boolean;
};

type SaveAction = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
export type WandActions = { terms: SuggestTermsFn; description: SuggestDescriptionFn };

/** 未配置分类的表单初值：启用、来源全关（保存时会提示至少开一个来源）。 */
const EMPTY: CollectConfig = {
  enabled: true,
  sources: { github: false, mcpRegistry: false, awesome: false, huggingface: false, productHunt: false },
  githubTopics: [],
  githubKeywords: [],
  githubMinStars: 500,
  githubNewMinStars: 100,
  hfSearch: [],
  description: "",
};

function statusText(r: CategoryCollectRowView) {
  if (r.invalid) return "配置格式异常，请重新保存";
  if (!r.config) return "未配置，不参与自动采集";
  if (!r.config.enabled) return "已关闭，不参与采集";
  if (r.active.length === 0) return "开启的来源在全局设置里都关着";
  return `来源：${r.active.map((k) => collectSourceLabels[k]).join("、")}`;
}

function Row({ r, max, isNext, action, wand }: { r: CategoryCollectRowView; max: number; isNext: boolean; action: SaveAction; wand?: WandActions }) {
  const [state, formAction, pending] = useActionState(action, { ok: true } as ActionResult);
  const c = r.config ?? EMPTY;
  const errs = !state.ok ? (state.fieldErrors ?? {}) : {};
  // zod 路径如 githubKeywords.1：按字段前缀取第一条错误
  const err = (k: string) => Object.entries(errs).find(([p]) => p === k || p.startsWith(`${k}.`))?.[1];
  const total = r.published + r.pending;
  const id = (k: string) => `cc-${r.slug}-${k}`;

  return (
    <li className={a.cat}>
      <details>
        <summary className={a.catHead}>
          <span className={a.catName}>
            {r.name}
            {isNext && <span className={a.nextTag}>自动下一个</span>}
          </span>
          <span className={a.catNums}>
            已上架 {r.published} / 待审核 {r.pending}
          </span>
          <span className={a.catBar} aria-hidden="true">
            <span style={{ width: `${max ? Math.round((total / max) * 100) : 0}%` }} />
          </span>
          <span className={`${a.catState} ${r.collectable ? "" : a.catOff}`}>{statusText(r)}</span>
        </summary>
        <form action={formAction} className={a.catForm} noValidate>
          {!state.ok && state.formError && <p className={styles.alert} role="alert">{state.formError}</p>}
          {state.ok && state.message && <p className={styles.ok} role="status">{state.message}</p>}
          <label className={styles.opt}>
            <input type="checkbox" name="enabled" defaultChecked={c.enabled} />
            <span>参与采集（自动模式会在已开启的分类里选资源最少的）</span>
          </label>
          <fieldset className={a.catSources}>
            <legend>可用来源（还需在左侧全局设置里开启）</legend>
            {collectSourceKeys.map((k) => (
              <label key={k} className={styles.opt}>
                <input type="checkbox" name={`src_${k}`} defaultChecked={c.sources[k]} />
                <span>
                  {collectSourceLabels[k]}
                  <span className={a.optHint}>{collectSourceHints[k]}</span>
                </span>
              </label>
            ))}
            {err("sources") && <p className={styles.err} role="alert">{err("sources")}</p>}
          </fieldset>
          <div className={`${styles.field} ${err("githubTopics") ? styles.bad : ""}`}>
            <div className={a.labelRow}>
              <label htmlFor={id("topics")}>GitHub 主题（topic，逗号或空格分隔，最多 8 个）</label>
              {wand && <TermWand field="githubTopics" inputId={id("topics")} suggest={wand.terms} />}
            </div>
            <input id={id("topics")} name="githubTopics" defaultValue={c.githubTopics.join(", ")} placeholder="mcp-server, model-context-protocol" autoComplete="off" />
            {err("githubTopics") ? <p className={styles.err} role="alert">{err("githubTopics")}</p> : <span className={styles.hint}>每次最多查 4 个主题/关键词（各 2 条查询），超出时按天轮换</span>}
          </div>
          <div className={`${styles.field} ${err("githubKeywords") ? styles.bad : ""}`}>
            <div className={a.labelRow}>
              <label htmlFor={id("kw")}>GitHub 关键词（逗号分隔，可含空格，最多 4 个）</label>
              {wand && <TermWand field="githubKeywords" inputId={id("kw")} suggest={wand.terms} />}
            </div>
            <input id={id("kw")} name="githubKeywords" defaultValue={c.githubKeywords.join(", ")} placeholder="mcp server" autoComplete="off" />
            {err("githubKeywords") ? <p className={styles.err} role="alert">{err("githubKeywords")}</p> : <span className={styles.hint}>在仓库名、简介、topics 里匹配整个短语</span>}
          </div>
          <div className={a.catStars}>
            <div className={`${styles.field} ${err("githubMinStars") ? styles.bad : ""}`}>
              <label htmlFor={id("ms")}>热门门槛（近 30 天活跃，star ≥）</label>
              <input id={id("ms")} name="githubMinStars" type="number" min={0} defaultValue={c.githubMinStars} />
              {err("githubMinStars") && <p className={styles.err} role="alert">{err("githubMinStars")}</p>}
            </div>
            <div className={`${styles.field} ${err("githubNewMinStars") ? styles.bad : ""}`}>
              <label htmlFor={id("ns")}>新秀门槛（近 120 天新建，star ≥）</label>
              <input id={id("ns")} name="githubNewMinStars" type="number" min={0} defaultValue={c.githubNewMinStars} />
              {err("githubNewMinStars") && <p className={styles.err} role="alert">{err("githubNewMinStars")}</p>}
            </div>
          </div>
          <div className={`${styles.field} ${err("hfSearch") ? styles.bad : ""}`}>
            <div className={a.labelRow}>
              <label htmlFor={id("hf")}>HF Spaces 搜索词（逗号或空格分隔，最多 6 个）</label>
              {wand && <TermWand field="hfSearch" inputId={id("hf")} suggest={wand.terms} />}
            </div>
            <input id={id("hf")} name="hfSearch" defaultValue={c.hfSearch.join(", ")} placeholder="image, video" autoComplete="off" />
            {err("hfSearch") ? <p className={styles.err} role="alert">{err("hfSearch")}</p> : <span className={styles.hint}>匹配 Space 名称（owner/name），每个词取点赞最高的 30 个；留空取全站热门</span>}
          </div>
          <div className={`${styles.field} ${err("description") ? styles.bad : ""}`}>
            <div className={a.labelRow}>
              <label htmlFor={id("desc")}>给模型的分类说明（≤500 字）</label>
              {wand && <DescriptionWand inputId={id("desc")} suggest={wand.description} />}
            </div>
            <textarea id={id("desc")} name="description" defaultValue={c.description} rows={3} maxLength={500} placeholder="什么样的资源属于这个分类、和相近分类怎么区分" />
            {err("description") && <p className={styles.err} role="alert">{err("description")}</p>}
          </div>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "保存中…" : "保存配置"}
          </Button>
        </form>
      </details>
    </li>
  );
}

/** 分类采集配置：每个分类一行（已上架 / 待审核计数 + 状态），展开后编辑。 */
export function CategoryCollectConfigs({
  rows,
  autoPickId,
  actions,
  wands,
}: {
  rows: CategoryCollectRowView[];
  autoPickId: string | null;
  actions: Record<string, SaveAction>;
  /** 各分类的 AI 扩词 Action（已绑定分类 id） */
  wands?: Record<string, WandActions>;
}) {
  const max = Math.max(0, ...rows.map((r) => r.published + r.pending));
  return (
    <Card>
      <h2 className={styles.cardTitle}>分类采集配置</h2>
      <p className={styles.hint}>采集按分类定向进行：只跑该分类开启的来源，GitHub 按它的主题 / 关键词搜索。条形图为「已上架 + 待审核」，越短越缺资源。点字段旁的魔法棒让 AI 推荐关键词，悬浮可看语义、理由和命中数，点选只加入输入框，保存后才生效。</p>
      {rows.length === 0 && <p className={styles.hint}>还没有分类</p>}
      <ul className={a.cats}>
        {rows.map((r) => (
          <Row key={r.id} r={r} max={max} isNext={r.id === autoPickId} action={actions[r.id]} wand={wands?.[r.id]} />
        ))}
      </ul>
    </Card>
  );
}
