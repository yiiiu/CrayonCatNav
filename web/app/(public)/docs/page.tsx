import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/docs/docs.module.css";
import { AGENT_IP_DAY, AGENT_IP_MIN } from "@/lib/security/rate-limit-core";

export const metadata: Metadata = {
  title: "Agent 接入文档",
  description: "让 Claude Code、Cursor、Codex 等 AI Agent 通过 MCP 或 HTTP API 直接查询蜡笔猫导航收录的 AI 资源。",
  alternates: { canonical: "/docs" },
};

export default function DocsHome() {
  return (
    <>
      <h1>Agent 接入文档</h1>
      <p className={styles.lead}>让你的 AI Agent 直接在蜡笔猫导航里找资源：按分类筛选、看详情、拿到安装命令，然后接着干活。</p>

      <h2>能做什么</h2>
      <p>
        比如你对 Agent 说「去蜡笔猫找一个适合 React 的无样式组件库」，它会先看有哪些分类，切到「UI 组件库」里按关键词和标签筛选，再查看候选的详情和快速上手，最后挑一个来用。挑选由
        Agent 自己的模型完成，本站只提供经过人工审核的资源数据。
      </p>

      <h2>三种接入方式</h2>
      <div className={styles.ways}>
        <Link href="/docs/mcp" className={styles.way}>
          <b>MCP</b>
          <small>Claude Code、Cursor、VS Code、Codex 等支持 MCP 的客户端，一行配置接入。推荐。</small>
        </Link>
        <Link href="/docs/skill" className={styles.way}>
          <b>Skill（即将推出）</b>
          <small>给支持 Agent Skills 的客户端装一个技能包，教它怎么查本站。</small>
        </Link>
        <Link href="/docs/cli" className={styles.way}>
          <b>CLI（即将推出）</b>
          <small>在终端或脚本里用 npx 直接查询。</small>
        </Link>
      </div>
      <p>
        以上方式底层都调用同一套 <Link href="/docs/api">HTTP API</Link>，你也可以直接用它。
      </p>

      <h2>提供的工具</h2>
      <div className={styles.tblWrap}>
        <table className={styles.tbl}>
          <thead>
            <tr><th scope="col">工具</th><th scope="col">作用</th></tr>
          </thead>
          <tbody>
            <tr><td><code>list_categories</code></td><td>列出分类及收录数量，先确定去哪个分类找</td></tr>
            <tr><td><code>list_tags</code></td><td>列出某个分类下的常用标签，用来精确筛选</td></tr>
            <tr><td><code>search_resources</code></td><td>按关键词、分类、标签、价格筛选，返回精简列表，可翻页</td></tr>
            <tr><td><code>get_resource</code></td><td>资源详情：介绍、核心功能、适用场景、快速上手、站内配套工具</td></tr>
          </tbody>
        </table>
      </div>

      <h2>使用限制</h2>
      <ul>
        <li>目前免费、匿名使用，不需要注册或 API Key。</li>
        <li>
          每个 IP 每分钟 {AGENT_IP_MIN.limit} 次、每天 {AGENT_IP_DAY.limit} 次；超出返回 429，并在 <code>Retry-After</code> 里告诉你多久后可以重试。
        </li>
        <li>全部只读，只返回已公开发布的资源。</li>
      </ul>

      <h2>隐私</h2>
      <p>我们只统计各工具的调用次数，不记录你的查询内容和参数。</p>
    </>
  );
}
