"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  convert,
  FORMAT_EXT,
  FORMAT_LABEL,
  FORMATS,
  type ConvertResult,
  type DataFormat,
} from "@/lib/tools/data-converter/logic";
import { CheckIcon, downloadText, Highlight, Toggle, useCopy } from "./shared";
import styles from "./tool.module.css";

const OPTIONS = FORMATS.map((f) => ({ value: f, label: FORMAT_LABEL[f] }));
const MIME: Record<DataFormat, string> = { json: "application/json", yaml: "application/yaml", toml: "application/toml" };

const EXAMPLE = '{\n  "name": "crayon-cat",\n  "version": 1,\n  "tags": ["ai", "mcp"],\n  "debug": false,\n  "owner": null\n}';

/** 全部转换在浏览器内完成，输入不会发送到服务器。 */
export default function DataConverterTool() {
  const [from, setFrom] = useState<DataFormat>("json");
  const [to, setTo] = useState<DataFormat>("yaml");
  const [text, setText] = useState("");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [resultFor, setResultFor] = useState<DataFormat>("yaml");
  const { copy, node: toast } = useCopy();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLOListElement>(null);
  const inputId = useId();

  const lineCount = useMemo(() => Math.max(1, text.split("\n").length), [text]);
  const badLine = result && !result.ok ? result.error.line : undefined;
  const empty = !text.trim();

  function run(nextTo = to, nextFrom = from) {
    if (!text.trim()) return;
    setResult(convert(text, nextFrom, nextTo));
    setResultFor(nextTo);
  }

  function changeFrom(f: DataFormat) {
    setFrom(f);
    let t = to;
    if (f === to) {
      t = FORMATS.find((x) => x !== f)!;
      setTo(t);
    }
    if (result) run(t, f);
  }

  function changeTo(t: DataFormat) {
    setTo(t);
    if (result) run(t);
  }

  /** 交换：把当前输出作为新的输入 */
  function swap() {
    const out = result?.ok ? result.output : null;
    setFrom(to);
    setTo(from);
    if (out !== null) {
      setText(out);
      setResult(convert(out, to, from));
      setResultFor(from);
    } else {
      setResult(null);
    }
  }

  function clear() {
    setText("");
    setResult(null);
    taRef.current?.focus();
  }

  function jumpToError() {
    if (!result || result.ok || !result.error.line || !taRef.current) return;
    const lines = text.split("\n");
    const { line, column = 1 } = result.error;
    const offset = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + Math.max(0, column - 1);
    const ta = taRef.current;
    ta.focus();
    ta.setSelectionRange(offset, Math.min(offset + 1, text.length));
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 22;
    ta.scrollTop = Math.max(0, (line - 3) * lh);
  }

  const output = result?.ok ? result.output : "";
  const fileName = `converted.${FORMAT_EXT[resultFor]}`;

  return (
    <>
      <Card className={styles.conv}>
        <span className={styles.lbl}>源格式</span>
        <Toggle label="源格式" value={from} options={OPTIONS} onChange={changeFrom} small />
        <button type="button" className={`${styles.mini} ${styles.eye}`} onClick={swap} aria-label="交换源格式与目标格式" title="交换">
          ⇄
        </button>
        <span className={styles.lbl}>目标格式</span>
        <Toggle label="目标格式" value={to} options={OPTIONS.filter((o) => o.value !== from)} onChange={changeTo} small />
      </Card>

      <div className={styles.cols}>
        <div className={styles.stack}>
          <Card className={styles.card}>
            <h2>
              <label htmlFor={inputId}>输入 · {FORMAT_LABEL[from]}</label>
            </h2>
            <div className={styles.editor}>
              <ol className={styles.gutter} ref={gutterRef} aria-hidden="true">
                {Array.from({ length: lineCount }, (_, i) => (
                  <li key={i} className={badLine === i + 1 ? styles.badline : undefined}>
                    {i + 1}
                  </li>
                ))}
              </ol>
              <textarea
                id={inputId}
                ref={taRef}
                className={styles.textarea}
                value={text}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                placeholder={`粘贴 ${FORMAT_LABEL[from]} 内容…`}
                aria-invalid={badLine ? true : undefined}
                aria-describedby={result && !result.ok ? `${inputId}-err` : undefined}
                onChange={(e) => {
                  setText(e.target.value);
                  if (result && !result.ok) setResult(null);
                }}
                onScroll={(e) => {
                  if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    run();
                  }
                }}
              />
            </div>
            <div className={styles.acts}>
              <Button variant="primary" onClick={() => run()} disabled={empty}>
                转换
              </Button>
              <Button onClick={clear} disabled={!text}>
                清空
              </Button>
              {empty ? (
                <button type="button" className={`${styles.linkbtn} ${styles.status}`} onClick={() => { setFrom("json"); setTo(to === "json" ? "yaml" : to); setText(EXAMPLE); setResult(null); }}>
                  填入示例
                </button>
              ) : (
                <span className={styles.status}>Ctrl / ⌘ + Enter 转换</span>
              )}
            </div>
          </Card>

          {result && !result.ok ? (
            <Card className={`${styles.info} ${styles.badcard}`} role="alert" id={`${inputId}-err`}>
              <p className={styles.notice}>
                <span aria-hidden="true">✖</span>
                <span>
                  <b>
                    解析失败{result.error.line ? `：第 ${result.error.line} 行${result.error.column ? `第 ${result.error.column} 列` : ""}` : ""}
                  </b>
                  <br />
                  {result.error.message}
                  {result.error.line ? (
                    <>
                      {" · "}
                      <button type="button" className={styles.linkbtn} onClick={jumpToError}>
                        定位到出错位置
                      </button>
                    </>
                  ) : null}
                </span>
              </p>
            </Card>
          ) : null}
        </div>

        <div className={styles.stack}>
          <Card className={styles.card}>
            <h2>输出 · {FORMAT_LABEL[resultFor]}</h2>
            {result?.ok ? (
              <pre className={styles.code} aria-label="转换结果">
                <Highlight text={output} lang={resultFor} />
              </pre>
            ) : (
              <div className={`${styles.code} ${styles.placeholder}`}>
                {result ? "修正输入后，转换结果会显示在这里" : empty ? "在左侧输入内容后点击「转换」" : "点击「转换」查看结果"}
              </div>
            )}
            <div className={styles.acts}>
              <Button variant={result?.ok ? "primary" : "default"} disabled={!result?.ok} onClick={() => copy(output)}>
                复制
              </Button>
              <Button disabled={!result?.ok} onClick={() => downloadText(fileName, output, MIME[resultFor])}>
                下载 {fileName}
              </Button>
              {result?.ok ? (
                <span className={styles.ok}>
                  <CheckIcon /> 转换成功{result.keyCount ? ` · ${result.keyCount} 个键` : ""}
                </span>
              ) : result ? (
                <span className={styles.status}>等待有效输入</span>
              ) : null}
            </div>
          </Card>

          {result?.ok && result.warnings.length ? (
            <Card className={`${styles.info} ${styles.amber}`}>
              {result.warnings.map((w) => (
                <p key={w} className={styles.notice}>
                  <span aria-hidden="true">⚠️</span>
                  <span>可能有损：{w}</span>
                </p>
              ))}
            </Card>
          ) : null}

          <Card className={styles.info}>
            <h2>转换说明</h2>
            <ul>
              <li>只转换数据本身，注释、缩进、引号风格等格式细节不会保留。</li>
              <li>TOML 不支持 null，顶层必须是键值表。</li>
              <li>日期、超大整数等类型差异会在转换后提示。</li>
            </ul>
          </Card>
        </div>
      </div>
      {toast}
    </>
  );
}
