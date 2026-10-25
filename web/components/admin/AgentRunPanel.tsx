"use client";

import { useActionState } from "react";
import { Button, Card } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import styles from "./admin.module.css";
import a from "./agent.module.css";

type Action0 = (prev: ActionResult) => Promise<ActionResult>;
type Action1 = (prev: ActionResult, fd: FormData) => Promise<ActionResult>;

function Feedback({ state }: { state: ActionResult }) {
  if (!state.ok && (state.formError || state.fieldErrors)) {
    return <p className={`${styles.alert} ${a.msg}`} role="alert">{state.formError ?? Object.values(state.fieldErrors ?? {})[0]}</p>;
  }
  if (state.ok && state.message) return <p className={`${styles.ok} ${a.msg}`} role="status">{state.message}</p>;
  return null;
}

/** 采集操作：开始采集 / 测试连接 / 贴链接整理。采集可能持续数分钟，期间按钮保持禁用。 */
export function AgentRunPanel({ run, test, link, running }: { run: Action0; test: Action0; link: Action1; running: boolean }) {
  const [runState, runAction, runPending] = useActionState(run, { ok: true } as ActionResult);
  const [testState, testAction, testPending] = useActionState(test, { ok: true } as ActionResult);
  const [linkState, linkAction, linkPending] = useActionState(link, { ok: true } as ActionResult);
  const busy = runPending || linkPending || running;

  return (
    <>
      <Card>
        <h2 className={styles.cardTitle}>采集</h2>
        <p className={styles.hint}>从开启的白名单来源拉取 → 去重 → 模型整理 → 检查链接 → 进候选箱。不会自动上架。</p>
        <div className={a.runBtns} style={{ marginTop: 12 }}>
          <form action={runAction}>
            <Button type="submit" variant="primary" disabled={busy}>
              {runPending ? "采集中…（约 1–3 分钟）" : running ? "有采集正在进行" : "开始采集"}
            </Button>
          </form>
          <form action={testAction}>
            <Button type="submit" disabled={testPending}>
              {testPending ? "测试中…" : "测试连接"}
            </Button>
          </form>
        </div>
        <Feedback state={runState} />
        <Feedback state={testState} />
        <p className={styles.hint} style={{ marginTop: 10 }}>保存设置后再测试；测试只发一条「回复 ok」的消息。</p>
      </Card>
      <Card>
        <h2 className={styles.cardTitle}>贴一个链接让它整理</h2>
        <form action={linkAction} className={a.linkRow}>
          <label className="sr-only" htmlFor="agent-link">链接</label>
          <input id="agent-link" name="url" type="url" inputMode="url" placeholder="https://github.com/owner/repo 或产品官网" required maxLength={500} />
          <Button type="submit" disabled={busy}>
            {linkPending ? "整理中…" : "整理"}
          </Button>
        </form>
        <Feedback state={linkState} />
        <p className={styles.hint} style={{ marginTop: 10 }}>只抓公网 http(s) 页面（10 秒超时、限制大小、拒绝内网地址）；GitHub 仓库链接直接读仓库信息。</p>
      </Card>
    </>
  );
}
