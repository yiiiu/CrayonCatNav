import type { Metadata } from "next";
import Link from "next/link";
import { CodeBlock } from "@/components/docs/CodeBlock";
import styles from "@/components/docs/docs.module.css";
import { Tabs } from "@/components/docs/Tabs";
import { SKILL_NAME } from "@/lib/agent-api/skill";
import { siteOrigin } from "@/lib/docs/urls";

export const metadata: Metadata = {
  title: "Skill 接入",
  description: "安装蜡笔猫导航 Agent Skill，让 Claude Code、Codex、Cursor、VS Code 的 Agent 学会查询收录的 AI 资源。",
  alternates: { canonical: "/docs/skill" },
};

const install = (dir: string, url: string) => `mkdir -p ${dir}/${SKILL_NAME} && curl -fsSL ${url} -o ${dir}/${SKILL_NAME}/SKILL.md`;

export default function SkillDocs() {
  const url = `${siteOrigin()}/skills/${SKILL_NAME}/SKILL.md`;
  const clients = [
    { id: "claude-code", label: "Claude Code", dir: "~/.claude/skills", project: ".claude/skills" },
    { id: "codex", label: "Codex", dir: "~/.agents/skills", project: ".agents/skills" },
    { id: "cursor", label: "Cursor", dir: "~/.cursor/skills", project: ".cursor/skills" },
    { id: "vscode", label: "VS Code", dir: "~/.copilot/skills", project: ".github/skills" },
  ].map((c) => ({
    id: c.id,
    label: c.label,
    content: (
      <>
        <p>安装到个人目录（所有项目可用）：</p>
        <CodeBlock label="终端" code={install(c.dir, url)} />
        <p>
          只给当前项目用，把目录换成 <code>{c.project}</code>。
        </p>
      </>
    ),
  }));

  return (
    <>
      <h1>Skill 接入</h1>
      <p className={styles.lead}>装一个技能包，Agent 就知道怎样在蜡笔猫导航里查资源。不需要配置 MCP，有终端就能用。</p>

      <h2>它做什么</h2>
      <p>
        技能包是一个 <code>SKILL.md</code> 文件，遵循 Agent Skills 开放标准。当你让 Agent 找工具、库或服务时，它会按技能里的流程：先看分类，再筛选，再看详情和快速上手，最后自己挑一个并说明理由。
      </p>
      <p>
        已接入 <Link href="/docs/mcp">MCP</Link> 时它会优先用 MCP 工具，否则用 curl 调 <Link href="/docs/api">HTTP API</Link>。
      </p>

      <h2>安装</h2>
      <Tabs label="选择客户端" items={clients} />
      <p className={styles.note}>Cursor 和 VS Code 也会读取 ~/.claude/skills 与 ~/.agents/skills，已经给 Claude Code 或 Codex 装过的话不用重复安装。</p>

      <h2>手动下载</h2>
      <p>也可以直接下载文件，放到客户端的 skills 目录下的 <code>{SKILL_NAME}/</code> 文件夹里：</p>
      <CodeBlock code={url} />

      <h2>试一试</h2>
      <CodeBlock code="帮我在蜡笔猫找一个能让 Agent 读网页的 MCP 服务，告诉我怎么配置。" />
      <p>更新技能时重新运行一次安装命令即可。</p>
    </>
  );
}
