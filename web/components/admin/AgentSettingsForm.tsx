"use client";

import { useActionState } from "react";
import { Button, Card, ScrollArea } from "@/components/ui";
import type { ActionResult } from "@/lib/domain/result";
import styles from "./admin.module.css";
import a from "./agent.module.css";
import { Field } from "./Field";

export type AgentSettingsValues = {
  baseUrl: string;
  model: string;
  maxPerRun: number;
  srcMcpRegistry: boolean;
  srcGithub: boolean;
  srcAwesome: boolean;
  srcHuggingface: boolean;
  srcProductHunt: boolean;
  cron: { enabled: boolean; secretConfigured: boolean; schedule: string; nextRunAt: string };
  apiKeyLast4: string | null;
  githubTokenLast4: string | null;
  phTokenLast4: string | null;
  unreadable: { apiKey: boolean; githubToken: boolean; phToken: boolean };
  keySource: "AGENT_ENCRYPTION_KEY" | "AUTH_SECRET" | null;
};

type Props = { action: (prev: ActionResult, fd: FormData) => Promise<ActionResult>; initial: AgentSettingsValues };

const SOURCES = [
  ["srcMcpRegistry", "MCP 官方 Registry", "近 14 天更新的 MCP 服务，无需 token"],
  ["srcGithub", "GitHub 搜索", "按目标分类配置的主题 / 关键词搜索，带 star 与活跃度门槛"],
  ["srcAwesome", "awesome 清单", "punkpeye/awesome-mcp-servers，官方实现优先"],
  ["srcHuggingface", "Hugging Face Spaces", "按目标分类的搜索词查询，按点赞排序"],
  ["srcProductHunt", "Product Hunt", "近 7 天 AI 话题高票产品，需要 Token，没有就跳过"],
] as const;

const fmtNext = new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

function secretHint(last4: string | null, unreadable: boolean, extra?: string) {
  if (unreadable) return "已保存的值无法解密（加密密钥已更换），请重新填写";
  if (last4) return `已保存（末四位 ${last4}），留空表示不修改${extra ? `；${extra}` : ""}`;
  return extra ?? "未设置";
}

export function AgentSettingsForm({ action, initial }: Props) {
  const [state, formAction, pending] = useActionState(action, { ok: true } as ActionResult);
  const err = (k: string) => (!state.ok ? state.fieldErrors?.[k] : undefined);

  return (
    <Card className={styles.fill}>
      <form action={formAction} className={a.split} style={{ display: "flex", flexDirection: "column", flex: "1 1 auto", minHeight: 0 }} noValidate>
        <h2 className={styles.cardTitle}>模型与来源设置</h2>
        {!state.ok && state.formError && <p className={styles.alert} role="alert">{state.formError}</p>}
        {state.ok && state.message && <p className={styles.ok} role="status">{state.message}</p>}
        <ScrollArea className={a.formBody} viewportClassName={a.formBodyVp}>
          {initial.keySource !== "AGENT_ENCRYPTION_KEY" && (
            <p className={a.warnBox}>
              {initial.keySource === "AUTH_SECRET"
                ? "未设置 AGENT_ENCRYPTION_KEY，密钥目前用 AUTH_SECRET 派生的密钥加密。更换 AUTH_SECRET 会让已保存的 API Key / Token 失效，需要重新填写。建议在环境变量里单独配置 AGENT_ENCRYPTION_KEY（如 openssl rand -base64 32）。"
                : "服务器未配置 AGENT_ENCRYPTION_KEY 或 AUTH_SECRET，无法保存密钥。"}
            </p>
          )}
          <h3 className={a.group}>模型（OpenAI 兼容格式）</h3>
          <Field label="Base URL" name="baseUrl" error={err("baseUrl")} hint="如 https://api.openai.com/v1，会请求 {Base URL}/chat/completions" wide>
            <input id="f-baseUrl" name="baseUrl" type="url" inputMode="url" placeholder="https://api.openai.com/v1" defaultValue={initial.baseUrl} autoComplete="off" />
          </Field>
          <Field label="模型名" name="model" error={err("model")} hint="需支持 response_format: json_object">
            <input id="f-model" name="model" defaultValue={initial.model} placeholder="gpt-4o-mini" autoComplete="off" />
          </Field>
          <Field label="API Key" name="apiKey" error={err("apiKey")} hint={secretHint(initial.apiKeyLast4, initial.unreadable.apiKey)}>
            <input id="f-apiKey" name="apiKey" type="password" autoComplete="new-password" placeholder={initial.apiKeyLast4 ? `••••${initial.apiKeyLast4}` : "sk-…"} />
          </Field>

          <h3 className={a.group}>采集</h3>
          <Field label="每次采集条数上限" name="maxPerRun" error={err("maxPerRun")} hint="1–20，默认 8；条数越多越可能超出函数执行时间">
            <input id="f-maxPerRun" name="maxPerRun" type="number" min={1} max={20} defaultValue={initial.maxPerRun} />
          </Field>
          <p className={`${styles.hint} ${a.wideHint}`}>全局开关：关掉的来源任何分类都不会跑；每个分类实际用哪些来源在右侧「分类采集配置」里设。</p>
          <div className={a.sources} role="group" aria-label="采集来源">
            {SOURCES.map(([name, label, hint]) => (
              <label key={name} className={styles.opt}>
                <input type="checkbox" name={name} defaultChecked={initial[name]} />
                <span>
                  {label}
                  <span className={a.optHint}>{hint}</span>
                </span>
              </label>
            ))}
          </div>

          <h3 className={a.group}>定时采集</h3>
          <label className={styles.opt}>
            <input type="checkbox" name="cronEnabled" defaultChecked={initial.cron.enabled} />
            <span>
              开启定时采集
              <span className={a.optHint}>
                {initial.cron.schedule}自动跑一次，目标分类按「自动」规则选择，条数与来源同上
                {initial.cron.enabled && initial.cron.secretConfigured ? `；下次 ${fmtNext.format(new Date(initial.cron.nextRunAt))}` : ""}
              </span>
            </span>
          </label>
          {!initial.cron.secretConfigured && (
            <p className={a.warnBox}>服务器未配置 CRON_SECRET，定时采集接口会拒绝执行。请在 Vercel 环境变量中添加 CRON_SECRET（如 openssl rand -hex 32）后重新部署。</p>
          )}
          <p className={`${styles.hint} ${a.wideHint}`}>运行时间由 vercel.json 固定，后台只能开关；改时间需要改代码重新部署。</p>

          <h3 className={a.group}>可选 Token</h3>
          <Field label="GitHub Token" name="githubToken" error={err("githubToken")} hint={secretHint(initial.githubTokenLast4, initial.unreadable.githubToken, "只需公开仓库只读权限，用于提高 API 限额")}>
            <input id="f-githubToken" name="githubToken" type="password" autoComplete="new-password" placeholder={initial.githubTokenLast4 ? `••••${initial.githubTokenLast4}` : "可不填"} />
            {initial.githubTokenLast4 && (
              <label className={a.clear}>
                <input type="checkbox" name="clearGithubToken" /> 清除已保存的 Token
              </label>
            )}
          </Field>
          <Field label="Product Hunt Token" name="phToken" error={err("phToken")} hint={secretHint(initial.phTokenLast4, initial.unreadable.phToken, "Product Hunt 开发者后台的 Developer Token")}>
            <input id="f-phToken" name="phToken" type="password" autoComplete="new-password" placeholder={initial.phTokenLast4 ? `••••${initial.phTokenLast4}` : "可不填"} />
            {initial.phTokenLast4 && (
              <label className={a.clear}>
                <input type="checkbox" name="clearPhToken" /> 清除已保存的 Token
              </label>
            )}
          </Field>
        </ScrollArea>
        <div className={a.foot}>
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "保存中…" : "保存设置"}
          </Button>
          <span className={styles.hint}>密钥用 AES-256-GCM 加密存库，页面只显示末四位</span>
        </div>
      </form>
    </Card>
  );
}
