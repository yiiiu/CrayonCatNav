import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/CodeBlock";
import styles from "@/components/docs/docs.module.css";

export const metadata: Metadata = {
  title: "CLI 接入",
  description: "用 npx crayoncat 在终端、脚本或 Agent 里查询蜡笔猫导航收录的 AI 资源。",
  alternates: { canonical: "/docs/cli" },
};

export default function CliDocs() {
  return (
    <>
      <h1>CLI 接入</h1>
      <p className={styles.lead}>在终端、脚本或没有 MCP 的 Agent 里，一条命令查资源。</p>
      <p className={styles.note}>npm 包即将发布，发布后即可用 npx 直接运行。在那之前可以先用 <Link href="/docs/api">HTTP API</Link>。</p>

      <h2>常用命令</h2>
      <CodeBlock label="列出分类" code="npx crayoncat categories" />
      <CodeBlock label="看某个分类的标签" code="npx crayoncat tags --category ui-components" />
      <CodeBlock label="筛选资源" code={`npx crayoncat search "React 无样式组件" --category ui-components --limit 5`} />
      <CodeBlock label="资源详情与快速上手" code="npx crayoncat show shadcn-ui" />

      <h2>选项</h2>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <thead><tr><th scope="col">选项</th><th scope="col">说明</th></tr></thead>
          <tbody>
            <tr><td><code>--category</code></td><td>分类 slug</td></tr>
            <tr><td><code>--tag</code></td><td>标签 slug，可重复</td></tr>
            <tr><td><code>--pricing</code></td><td><code>free</code> / <code>freemium</code> / <code>paid</code></td></tr>
            <tr><td><code>--limit</code> / <code>--cursor</code></td><td>每页条数（1–20）与翻页</td></tr>
            <tr><td><code>--json</code></td><td>输出原始 JSON，适合 Agent 和脚本解析</td></tr>
            <tr><td><code>--base</code></td><td>服务地址，也可用环境变量 <code>CRAYONCAT_BASE_URL</code></td></tr>
          </tbody>
        </table>
      </div>

      <h2>给 Agent 用</h2>
      <p>在 AGENTS.md 或 CLAUDE.md 里加一句，Agent 就会在需要时调用：</p>
      <CodeBlock code="需要找 AI 工具、MCP 服务、组件库等资源时，先用 `npx crayoncat search <关键词> --json` 查询蜡笔猫导航，再用 `npx crayoncat show <slug> --json` 看详情和安装方式。" />

      <h2>退出码</h2>
      <p>0 成功，1 请求失败（含 429 限流），2 参数错误，4 资源不存在。需要 Node.js 20 以上，无其他依赖。</p>
    </>
  );
}
