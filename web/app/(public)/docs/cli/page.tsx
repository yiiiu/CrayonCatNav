import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/docs/docs.module.css";

export const metadata: Metadata = {
  title: "CLI 接入",
  description: "蜡笔猫导航命令行工具（即将推出）。",
  alternates: { canonical: "/docs/cli" },
};

export default function CliDocs() {
  return (
    <>
      <h1>CLI 接入</h1>
      <p className={styles.lead}>即将推出。</p>
      <p>
        我们会发布一个命令行工具，用 <code>npx</code> 就能在终端或脚本里查分类、搜资源、看详情，方便没有 MCP 的 Agent 或自动化流程使用。
      </p>
      <p>
        在那之前，可以直接用 <Link href="/docs/api">HTTP API</Link>，比如用 curl 请求。
      </p>
    </>
  );
}
