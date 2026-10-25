import Link from "next/link";
import { connection } from "next/server";
import { AdminTop } from "@/components/admin/AdminTop";
import { AgentRunPanel } from "@/components/admin/AgentRunPanel";
import { AgentSettingsForm } from "@/components/admin/AgentSettingsForm";
import { CategoryCollectConfigs } from "@/components/admin/CategoryCollectConfigs";
import styles from "@/components/admin/admin.module.css";
import a from "@/components/admin/agent.module.css";
import { Card, ScrollArea } from "@/components/ui";
import { sourceLabels, type CandidateSource } from "@/lib/agent/types";
import { listRuns } from "@/lib/data/agent.repo";
import { getSettingsView } from "@/lib/domain/agent-settings.service";
import { getCollectOverview } from "@/lib/domain/category-collect.service";
import { collectLinkAction, runCollectAction, saveAgentSettingsAction, saveCollectConfigAction, testAgentConnectionAction } from "../actions";

export const metadata = { title: "采集 Agent" };

/** 本页触发的 server action（开始采集 / 贴链接整理）最长可运行 300 秒（Vercel 函数上限内）。 */
export const maxDuration = 300;

const triggerLabels: Record<string, string> = { manual: "手动", cron: "定时", link: "贴链接" };
const statusLabels: Record<string, string> = { running: "运行中", succeeded: "完成", failed: "失败" };

const fmt = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

type Notes = {
  target?: { slug: string; name: string; mode: "auto" | "manual"; snapshot?: { slug: string; total: number; collectable: boolean }[] };
  sources?: { source: CandidateSource; fetched: number; error?: string }[];
  items?: string[];
} | null;

export default async function AgentPage() {
  await connection(); // 读设置时会 upsert 单例（写操作），必须在请求时执行
  // 先读设置（会 upsert 单例），再并行读分类概览与运行记录
  const view = await getSettingsView();
  const [overview, runs] = await Promise.all([getCollectOverview(), listRuns(12)]);
  const nameBySlug = new Map(overview.rows.map((r) => [r.slug, r.name]));
  const configActions = Object.fromEntries(overview.rows.map((r) => [r.id, saveCollectConfigAction.bind(null, r.id)]));
  return (
    <>
      <AdminTop title="采集 Agent">
        <Link href="/admin/candidates">去候选箱审核 ›</Link>
      </AdminTop>
      <div className={styles.split}>
        <AgentSettingsForm action={saveAgentSettingsAction} initial={view} />
        <ScrollArea className={a.side} viewportClassName={a.sideVp}>
          <AgentRunPanel
            run={runCollectAction}
            test={testAgentConnectionAction}
            link={collectLinkAction}
            running={view.running}
            targets={overview.rows.map((r) => ({ id: r.id, name: r.name, total: r.published + r.pending, collectable: r.collectable }))}
            autoPickName={overview.autoPick?.name ?? null}
          />
          <CategoryCollectConfigs
            rows={overview.rows.map((r) => ({
              id: r.id,
              slug: r.slug,
              name: r.name,
              published: r.published,
              pending: r.pending,
              config: r.config,
              invalid: r.invalid,
              active: r.active,
              collectable: r.collectable,
            }))}
            autoPickId={overview.autoPick?.id ?? null}
            actions={configActions}
          />
          <Card>
            <h2 className={styles.cardTitle}>最近运行</h2>
            {runs.length === 0 && <p className={styles.hint}>还没有运行记录</p>}
            <ol className={a.runs}>
              {runs.map((r) => {
                const notes = r.notes as Notes;
                const duration = r.finishedAt ? Math.round((r.finishedAt.getTime() - r.startedAt.getTime()) / 1000) : null;
                return (
                  <li key={r.id} className={a.run}>
                    <div className={a.runHead}>
                      <span>
                        {fmt.format(r.startedAt)} · {triggerLabels[r.trigger] ?? r.trigger}
                        {(r.category ?? notes?.target) && (
                          <>
                            {" · "}
                            <span className={a.tgt}>
                              {notes?.target?.mode === "auto" ? "自动→" : ""}
                              {r.category?.name ?? notes?.target?.name ?? ""}
                              {!r.category ? "（已删除）" : ""}
                            </span>
                          </>
                        )}
                      </span>
                      <span className={a[`ok_${r.status}`]}>
                        {statusLabels[r.status]}
                        {duration !== null ? ` · ${duration}s` : ""}
                      </span>
                    </div>
                    <div className={a.runNums}>
                      发现 {r.found} · 新增 {r.created} · 跳过 {r.skipped} · 失败 {r.failed}
                      {r.promptTokens ? ` · Token ${r.promptTokens}+${r.completionTokens ?? 0}` : ""}
                    </div>
                    {r.error && <div className={a.runErr}>{r.error}</div>}
                    {notes && (notes.sources?.length || notes.items?.length || notes.target?.snapshot?.length) ? (
                      <details className={a.runNotes}>
                        <summary>详情</summary>
                        <ul>
                          {notes.target?.snapshot?.length ? (
                            <li>
                              选择时各分类（已上架+待审核）：
                              {notes.target.snapshot.map((x) => `${nameBySlug.get(x.slug) ?? x.slug} ${x.total}${x.collectable ? "" : "（未参与）"}`).join("、")}
                            </li>
                          ) : null}
                          {notes.sources?.map((s) => (
                            <li key={s.source}>
                              {sourceLabels[s.source] ?? s.source}：{s.error ? s.error : `拉到 ${s.fetched} 条`}
                            </li>
                          ))}
                          {notes.items?.map((t, i) => <li key={i}>{t}</li>)}
                        </ul>
                      </details>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </Card>
        </ScrollArea>
      </div>
    </>
  );
}
