"use client";

import { useCopy } from "@/components/tool/shared";
import styles from "./resource.module.css";

/** 快速上手代码块：原样展示安装命令 / 配置片段，一键复制。 */
export function QuickStart({ code }: { code: string }) {
  const { copy, node: toast } = useCopy();
  return (
    <div className={styles.qs}>
      <pre>
        <code>{code}</code>
      </pre>
      <button type="button" className={styles.qsCopy} onClick={() => void copy(code)}>
        复制
      </button>
      {toast}
    </div>
  );
}
