import Link from "next/link";
import { connection } from "next/server";
import { AdminTop } from "@/components/admin/AdminTop";
import { AgentRunPanel } from "@/components/admin/AgentRunPanel";
import { AgentSettingsForm } from "@/components/admin/AgentSettingsForm";
import styles from "@/components/admin/admin.module.css";
import a from "@/components/admin/agent.module.css";
import { Card, ScrollArea } from "@/components/ui";
import { sourceLabels, type CandidateSource } from "@/lib/agent/types";
import { listRuns } from "@/lib/data/agent.repo";
import { getSettingsView } from "@/lib/domain/agent-settings.service";
import { collectLinkAction, runCollectAction, saveAgentSettingsAction, testAgentConnectionAction } from "../actions";

export const metadata = { title: "采集 Agent" };

/** 本页触发的 server action（开始采集 / 贴链接整理）最长可运行 300 秒（Vercel 函数上限内）。 */
export const maxDuration = 300;

const triggerLabels: Record<string, string> = { manual: "手动", cron: "定时", link: "贴链接" };
const statusLabels: Record<string, string> = { running: "运行中", succeeded: "完成", failed: "失败" };

const fmt = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });

type Notes = { sources?: { source: CandidateSource; fetched: number; error?: string }[]; items?: string[] } | null;

export default async function AgentPage() {
  await connection(); // 读设置时会 upsert 单例（写操作），必须在请求时执行
  const [view, runs] = await Promise.all([getSettingsView(), listRuns(12)]);
  return (
    <>
      <AdminTop title="采集 Agent">
        <Link href="/admin/candidates">去候选箱审核 ›</Link>
      </AdminTop>
      <div className={styles.split}>
        <AgentSettingsForm action={saveAgentSettingsAction} initial={view} />
        <ScrollArea className={a.side} viewportClassName={a.sideVp}>
          <AgentRunPanel run={runCollectAction} test={testAgentConnectionAction} link={collectLinkAction} running={view.running} />
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
                    {notes && (notes.sources?.length || notes.items?.length) ? (
                      <details className={a.runNotes}>
                        <summary>详情</summary>
                        <ul>
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
