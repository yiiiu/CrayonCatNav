"use client";

import { useId, useState } from "react";
import { Button, Card } from "@/components/ui";
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

/**
 * MCP 配置生成器：只生成 JSON，不执行命令、不发请求。
 * env 值（常为 API Key）只存在于本组件 state：不进 URL、不入埋点、不持久化。
 */
export default function McpConfigTool() {
  const [client, setClient] = useState<McpClient>("cursor");
  const [name, setName] = useState("filesystem");
  const [command, setCommand] = useState("npx");
  const [args, setArgs] = useState<Row<string>[]>(() => [row("-y"), row("@modelcontextprotocol/server-filesystem"), row("/Users/me/Projects")]);
  const [env, setEnv] = useState<Row<EnvPair>[]>([]);
  const [reveal, setReveal] = useState<Record<number, boolean>>({});
  const [touched, setTouched] = useState({ name: false, command: false });
  const { copy, node: toast } = useCopy();
  const uid = useId();

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

  const showNameErr = errors.name && (touched.name || !name);
  const showCmdErr = errors.command && (touched.command || !command.trim());

  return (
    <div className={styles.cols}>
      <div className={styles.stack}>
        <Card className={styles.card}>
          <h2>服务器设置</h2>
          <div className={styles.row}>
            <span className={styles.lbl}>客户端</span>
            <Toggle label="客户端" value={client} options={CLIENT_OPTIONS} onChange={setClient} />
          </div>
          <div className={styles.row}>
            <span className={styles.lbl}>传输模式</span>
            <span className={styles.static}>stdio</span>
          </div>

          <div className={`${styles.field} ${showNameErr ? styles.bad : ""}`}>
            <label htmlFor={`${uid}-name`}>服务名称</label>
            <input
              id={`${uid}-name`}
              className={`${styles.input} ${styles.mono}`}
              value={name}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={showNameErr ? true : undefined}
              aria-describedby={showNameErr ? `${uid}-name-err` : undefined}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, name: true }))}
            />
            {showNameErr ? <p className={styles.err} id={`${uid}-name-err`}>{errors.name}</p> : null}
          </div>

          <div className={`${styles.field} ${showCmdErr ? styles.bad : ""}`}>
            <label htmlFor={`${uid}-cmd`}>command</label>
            <input
              id={`${uid}-cmd`}
              className={`${styles.input} ${styles.mono}`}
              value={command}
              placeholder="例如 npx"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={showCmdErr ? true : undefined}
              aria-describedby={showCmdErr ? `${uid}-cmd-err` : `${uid}-cmd-hint`}
              onChange={(e) => setCommand(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, command: true }))}
              onPaste={(e) => {
                const t = e.clipboardData.getData("text");
                if (/\s/.test(t.trim())) {
                  e.preventDefault();
                  pasteCommandLine(t);
                }
              }}
            />
            {showCmdErr ? (
              <p className={styles.err} id={`${uid}-cmd-err`}>{errors.command}</p>
            ) : (
              <small id={`${uid}-cmd-hint`}>粘贴整行命令会自动拆分为 command 与 args</small>
            )}
          </div>

          <h3>args 参数</h3>
          {args.length === 0 ? <p className={styles.hint}>暂无参数</p> : null}
          {args.map((a, i) => (
            <div className={styles.argrow} key={a.id}>
              <input
                className={`${styles.input} ${styles.mono}`}
                value={a.value}
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

          <h3>env 环境变量</h3>
          {env.length === 0 ? <p className={styles.hint}>暂无环境变量</p> : null}
          {env.map((e, i) => {
            const keyErr = errors.envKeys?.[i];
            return (
              <div key={e.id}>
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
            <Button variant={real.ok ? "primary" : "default"} disabled={!real.ok} onClick={() => real.ok && copy(real.json, hasSecrets ? "已复制（含完整密钥）✓" : "已复制 ✓")}>
              复制
            </Button>
            <Button disabled={!real.ok} onClick={() => real.ok && downloadText(info.fileName, real.json, "application/json")}>
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
