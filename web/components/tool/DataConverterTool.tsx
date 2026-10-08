"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
import { trackEvent } from "@/lib/analytics/track";
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

function DataConverterInner() {
  const sp = useSearchParams();

  // 读取白名单参数：from, to
  const pFrom = sp.get("from");
  const initialFrom: DataFormat = pFrom && (FORMATS as readonly string[]).includes(pFrom) ? (pFrom as DataFormat) : "json";

  const pTo = sp.get("to");
  const initialTo: DataFormat =
    pTo && (FORMATS as readonly string[]).includes(pTo) && pTo !== initialFrom
      ? (pTo as DataFormat)
      : initialFrom === "json"
        ? "yaml"
        : "json";

  const [from, setFrom] = useState<DataFormat>(initialFrom);
  const [to, setTo] = useState<DataFormat>(initialTo);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ConvertResult | null>(null);
  const [resultFor, setResultFor] = useState<DataFormat>(initialTo);
  const { copy, node: toast } = useCopy();
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLOListElement>(null);
  const inputId = useId();

  useEffect(() => {
    trackEvent({ eventType: "tool_open", toolId: "data-converter" });
  }, []);

  const lineCount = useMemo(() => Math.max(1, text.split("\n").length), [text]);
  const badLine = result && !result.ok ? result.error.line : undefined;
  const empty = !text.trim();

  function run(nextTo = to, nextFrom = from) {
    if (!text.trim()) return;
    const res = convert(text, nextFrom, nextTo);
    setResult(res);
    setResultFor(nextTo);
    if (res.ok) {
      trackEvent({ eventType: "tool_execute", toolId: "data-converter" });
    }
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
    if (!out) return;
    const nextFrom = to;
    const nextTo = from;
    setFrom(nextFrom);
    setTo(nextTo);
    setText(out);
    setResult(convert(out, nextFrom, nextTo));
    setResultFor(nextTo);
  }

  function handleCopy(output: string) {
    copy(output);
    trackEvent({ eventType: "tool_execute", toolId: "data-converter" });
  }

  function handleDownload(fileName: string, output: string) {
    downloadText(fileName, output, MIME[resultFor]);
    trackEvent({ eventType: "tool_execute", toolId: "data-converter" });
  }

  function fillExample() {
    setFrom("json");
    setTo("yaml");
    setText(EXAMPLE);
    setResult(convert(EXAMPLE, "json", "yaml"));
    setResultFor("yaml");
  }

  function clear() {
    setText("");
    setResult(null);
    taRef.current?.focus();
  }

  /** 点击报错位置：光标移动到对应行 */
  function gotoLine(line: number) {
    const ta = taRef.current;
    if (!ta) return;
    const lines = text.split("\n");
    let pos = 0;
    for (let i = 0; i < Math.min(line - 1, lines.length); i++) pos += lines[i].length + 1;
    const end = pos + (lines[line - 1]?.length ?? 0);
    ta.focus();
    ta.setSelectionRange(pos, end);
  }

  function syncScroll() {
    if (taRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = taRef.current.scrollTop;
    }
  }

  const output = result?.ok ? result.output : "";
  const fileName = `converted.${FORMAT_EXT[resultFor]}`;

  return (
    <>
      <div className={styles.bar}>
        <div className={styles.dir}>
          <span className={styles.lbl}>源格式</span>
          <Toggle label="源格式" options={OPTIONS} value={from} onChange={changeFrom} />
          <button type="button" className={styles.swap} title="交换源与目标格式" aria-label="交换格式" disabled={!result?.ok} onClick={swap}>
            ⇄
          </button>
          <span className={styles.lbl}>目标</span>
          <Toggle label="目标格式" options={OPTIONS} value={to} onChange={changeTo} />
        </div>
        <div className={styles.acts}>
          <Button variant="primary" disabled={empty} onClick={() => run()}>
            转换
          </Button>
          <Button onClick={fillExample}>填入示例</Button>
          <Button disabled={empty} onClick={clear}>
            清空
          </Button>
        </div>
      </div>

      <div className={styles.cols}>
        <div className={styles.stack}>
          <Card className={styles.card}>
            <div className={styles.head}>
              <label htmlFor={inputId} className={styles.title}>
                输入 · {FORMAT_LABEL[from]}
              </label>
              <span className={styles.count}>{lineCount} 行 · {text.length} 字</span>
            </div>
            <div className={styles.editor}>
              <ol ref={gutterRef} className={styles.gutter} aria-hidden="true">
                {Array.from({ length: lineCount }, (_, i) => i + 1).map((n) => (
                  <li key={n} className={n === badLine ? styles.badgutter : undefined}>
                    {n}
                  </li>
                ))}
              </ol>
              <textarea
                id={inputId}
                ref={taRef}
                className={styles.area}
                value={text}
                placeholder={`在此粘贴或输入 ${FORMAT_LABEL[from]} 内容…`}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                onChange={(e) => setText(e.target.value)}
                onScroll={syncScroll}
              />
            </div>
          </Card>

          {result && !result.ok ? (
            <Card className={`${styles.info} ${styles.errcard}`} role="alert">
              <p className={styles.notice}>
                <span aria-hidden="true">⚠️</span>
                <span>
                  <b>解析错误</b>
                  {result.error.line ? (
                    <>
                      （第 {result.error.line} 行{result.error.column ? `第 ${result.error.column} 列` : ""}）：
                      <button type="button" className={styles.locbtn} onClick={() => gotoLine(result.error.line!)}>
                        定位到出错行
                      </button>
                    </>
                  ) : (
                    "："
                  )}
                  {result.error.message}
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
              <Button variant={result?.ok ? "primary" : "default"} disabled={!result?.ok} onClick={() => handleCopy(output)}>
                复制
              </Button>
              <Button disabled={!result?.ok} onClick={() => handleDownload(fileName, output)}>
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

/** 全部转换在浏览器内完成，输入不会发送到服务器。 */
export default function DataConverterTool() {
  return (
    <Suspense fallback={<div className={styles.empty}>加载数据转换器…</div>}>
      <DataConverterInner />
    </Suspense>
  );
}
