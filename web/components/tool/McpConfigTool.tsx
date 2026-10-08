"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useState } from "react";
import { Button, Card } from "@/components/ui";
import { trackEvent } from "@/lib/analytics/track";
import {
  buildConfig,
  CLIENT_INFO,
  CLIENTS,
  splitCommandLine,
  type EnvPair,
  type McpClient,
} from "@/lib/tools/mcp-config/logic";
import { CheckIcon, downloadText, EyeIcon, Highlight, Toggle, useCopy } from "./shared";
import styles from "./tool.module.css";

const CLIENT_OPTIONS = CLIENTS.map((c) => ({ value: c, label: CLIENT_INFO[c].label }));

type Row<T> = { id: number; value: T };
let seq = 0;
const row = <T,>(value: T): Row<T> => ({ id: ++seq, value });

function McpConfigInner() {
  const sp = useSearchParams();

  // 读取非敏感白名单参数：client, server, cmd, args（env/密钥永不从 URL 读取）
  const paramClient = sp.get("client");
  const initialClient: McpClient = paramClient === "claude" ? "claude" : "cursor";

  const paramServer = sp.get("server")?.trim();
  const initialName = paramServer || "filesystem";

  const paramCmd = sp.get("cmd")?.trim();
  const initialCmd = paramCmd || "npx";

  const paramArgs = sp.get("args")?.trim();
  const getInitialArgs = () => {
    if (paramArgs) {
      const parts = splitCommandLine(`dummy ${paramArgs}`).args;
      if (parts.length > 0) return parts.map((p) => row(p));
    }
    return [row("-y"), row("@modelcontextprotocol/server-filesystem"), row("/Users/me/Projects")];
  };

  const [client, setClient] = useState<McpClient>(initialClient);
  const [name, setName] = useState(initialName);
  const [command, setCommand] = useState(initialCmd);
  const [args, setArgs] = useState<Row<string>[]>(getInitialArgs);
  const [env, setEnv] = useState<Row<EnvPair>[]>([]);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [touched, setTouched] = useState({ name: false, command: false });
  const { copy, node: toast } = useCopy();
  const uid = useId();

  useEffect(() => {
    trackEvent({ eventType: "tool_open", toolId: "mcp-config" });
  }, []);

  const input = { client, name, command, args: args.map((a) => a.value), env: env.map((e) => e.value) };
  const real = buildConfig(input);
  const preview = buildConfig(input, { mask: true });
  const errors = real.ok ? {} : real.errors;
  const info = CLIENT_INFO[client];
  const hasSecrets = env.some((e) => e.value.value);

  function pasteCommandLine(text: string) {
    const parsed = splitCommandLine(text.trim());
    if (!parsed.command) return;
    setCommand(parsed.command);
    setArgs(parsed.args.map((a) => row(a)));
  }

  function handleCopy() {
    if (!real.ok) return;
    copy(real.json, hasSecrets ? "已复制（含完整密钥）✓" : "已复制 ✓");
    trackEvent({ eventType: "tool_execute", toolId: "mcp-config" });
  }

  function handleDownload() {
    if (!real.ok) return;
    downloadText(info.fileName, real.json, "application/json");
    trackEvent({ eventType: "tool_execute", toolId: "mcp-config" });
  }

  const showNameErr = errors.name && (touched.name || !name);
  const showCmdErr = errors.command && (touched.command || !command.trim());

  return (
    <div className={styles.cols}>
      <div className={styles.stack}>
        <Card className={styles.card}>
          <h2>服务器设置</h2>
          <div className={styles.row}>
            <span className={styles.lbl}>客户端</span>
            <Toggle label="客户端" options={CLIENT_OPTIONS} value={client} onChange={setClient} />
          </div>

          <div className={`${styles.field} ${showNameErr ? styles.bad : ""}`}>
            <label htmlFor={`${uid}-name`}>服务名称</label>
            <input
              id={`${uid}-name`}
              className={`${styles.input} ${styles.mono}`}
              value={name}
              placeholder="例如 filesystem、github"
              aria-invalid={showNameErr ? true : undefined}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            {showNameErr ? <p className={styles.err}>{errors.name}</p> : null}
          </div>

          <div className={`${styles.field} ${showCmdErr ? styles.bad : ""}`}>
            <label htmlFor={`${uid}-cmd`}>
              启动命令 <small>（例如 npx、node、uvx、docker、python）</small>
            </label>
            <input
              id={`${uid}-cmd`}
              className={`${styles.input} ${styles.mono}`}
              value={command}
              placeholder="例如 npx"
              aria-invalid={showCmdErr ? true : undefined}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setCommand(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, command: true }))}
              onPaste={(e) => {
                const text = e.clipboardData.getData("text");
                if (text.includes(" ")) {
                  e.preventDefault();
                  pasteCommandLine(text);
                }
              }}
            />
            {showCmdErr ? <p className={styles.err}>{errors.command}</p> : null}
          </div>

          <h3>命令参数</h3>
          {args.length === 0 ? <p className={styles.empty}>未添加参数</p> : null}
          {args.map((a, i) => (
            <div key={a.id} className={styles.argrow}>
              <input
                className={`${styles.input} ${styles.mono}`}
                value={a.value}
                placeholder="例如 -y 或参数值"
                aria-label={`参数 ${i + 1}`}
                spellCheck={false}
                autoComplete="off"
                onChange={(e) => setArgs((xs) => xs.map((x) => (x.id === a.id ? { ...x, value: e.target.value } : x)))}
              />
              <button type="button" className={styles.mini} aria-label={`删除参数 ${i + 1}`} onClick={() => setArgs((xs) => xs.filter((x) => x.id !== a.id))}>
                ×
              </button>
            </div>
          ))}
          <button type="button" className={styles.add} onClick={() => setArgs((xs) => [...xs, row("")])}>
            + 添加参数
          </button>

          <h3>环境变量 <small className={styles.dim}>（仅保存在本页状态，不进 URL、不上报）</small></h3>
          {env.length === 0 ? <p className={styles.empty}>无需环境变量则留空</p> : null}
          {env.map((e, i) => {
            const keyErr = errors.envKeys?.[i];
            return (
              <div key={e.id} className={styles.argblock}>
                <div className={styles.argrow}>
                  <input
                    className={`${styles.input} ${styles.mono} ${styles.k} ${keyErr ? styles.bad : ""}`}
                    value={e.value.key}
                    placeholder="变量名"
                    aria-label={`变量名 ${i + 1}`}
                    aria-invalid={keyErr ? true : undefined}
                    spellCheck={false}
                    autoComplete="off"
                    onChange={(ev) => setEnv((xs) => xs.map((x) => (x.id === e.id ? { ...x, value: { ...x.value, key: ev.target.value } } : x)))}
                  />
                  <span className={styles.eq} aria-hidden="true">=</span>
                  <input
                    className={`${styles.input} ${styles.mono}`}
                    type={reveal[e.id] ? "text" : "password"}
                    value={e.value.value}
                    placeholder="值"
                    aria-label={`变量值 ${i + 1}`}
                    autoComplete="off"
                    spellCheck={false}
                    data-1p-ignore
                    data-lpignore="true"
                    onChange={(ev) => setEnv((xs) => xs.map((x) => (x.id === e.id ? { ...x, value: { ...x.value, value: ev.target.value } } : x)))}
                  />
                  <button
                    type="button"
                    className={`${styles.mini} ${styles.eye}`}
                    aria-label={reveal[e.id] ? `隐藏变量值 ${i + 1}` : `显示变量值 ${i + 1}`}
                    aria-pressed={!!reveal[e.id]}
                    onClick={() => setReveal((r) => ({ ...r, [e.id]: !r[e.id] }))}
                  >
                    <EyeIcon off={!!reveal[e.id]} />
                  </button>
                  <button type="button" className={styles.mini} aria-label={`删除环境变量 ${i + 1}`} onClick={() => setEnv((xs) => xs.filter((x) => x.id !== e.id))}>
                    ×
                  </button>
                </div>
                {keyErr ? <p className={`${styles.err} ${styles.argerr}`}>{keyErr}</p> : null}
              </div>
            );
          })}
          <button type="button" className={styles.add} onClick={() => setEnv((xs) => [...xs, row({ key: "", value: "" })])}>
            + 添加环境变量
          </button>
        </Card>

        {env.length ? (
          <Card className={`${styles.info} ${styles.warn}`}>
            <p className={styles.notice}>
              <span aria-hidden="true">⚠️</span>
              <span>API Key 是敏感信息：只在你本机生成，不会发送、保存或记录。预览中已掩码，复制和下载的是完整值，注意不要提交到代码仓库。</span>
            </p>
          </Card>
        ) : null}
      </div>

      <div className={styles.stack}>
        <Card className={styles.card}>
          <h2>配置预览</h2>
          {preview.ok ? (
            <pre className={styles.code} aria-label="生成的配置">
              <Highlight text={preview.json} lang="json" />
            </pre>
          ) : (
            <div className={`${styles.code} ${styles.placeholder}`}>
              <span>
                <span className={styles.dim}>{"{ \"mcpServers\": { … } }"}</span>
                修正 {preview.count} 处错误后生成
              </span>
            </div>
          )}
          <div className={styles.acts}>
            <Button variant={real.ok ? "primary" : "default"} disabled={!real.ok} onClick={handleCopy}>
              复制
            </Button>
            <Button disabled={!real.ok} onClick={handleDownload}>
              下载 {info.fileName}
            </Button>
            {real.ok ? (
              <span className={styles.ok}>
                <CheckIcon /> JSON 校验通过
              </span>
            ) : null}
          </div>
        </Card>

        {real.ok && real.warnings.length ? (
          <Card className={`${styles.info} ${styles.amber}`}>
            {real.warnings.map((w) => (
              <p key={w} className={styles.notice}>
                <span aria-hidden="true">⚠️</span>
                <span>{w}</span>
              </p>
            ))}
          </Card>
        ) : null}

        <Card className={styles.info}>
          <h2>配置文件位置 · {info.label}</h2>
          <ul>
            {info.locations.map((l) => (
              <li key={l.path}>
                {l.label} <code>{l.path}</code>
              </li>
            ))}
          </ul>
          <p>
            文件里已有其他服务时，只需把 <code>mcpServers</code> 下的这一项合并进去。{info.note}{" "}
            <a href={info.docUrl} target="_blank" rel="noopener noreferrer">
              官方文档
            </a>
          </p>
        </Card>
      </div>
      {toast}
    </div>
  );
}

/**
 * MCP 配置生成器：只生成 JSON，不执行命令、不发请求。
 * env 值（常为 API Key）只存在于本组件 state：不进 URL、不入埋点、不持久化。
 */
export default function McpConfigTool() {
  return (
    <Suspense fallback={<div className={styles.empty}>加载配置生成器…</div>}>
      <McpConfigInner />
    </Suspense>
  );
}
