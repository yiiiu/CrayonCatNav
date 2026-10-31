"use client";

import { useCopy } from "@/components/tool/shared";
import styles from "./docs.module.css";

/** 文档代码块：原样展示，一键复制。label 用来标注文件名或语言。 */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { copy, node: toast } = useCopy();
  return (
    <div className={styles.code}>
      {label && <span className={styles.codeLabel}>{label}</span>}
      <pre>
        <code>{code}</code>
      </pre>
      <button type="button" className={styles.copy} onClick={() => void copy(code)} aria-label={label ? `复制 ${label}` : "复制代码"}>
        复制
      </button>
      {toast}
    </div>
  );
}
