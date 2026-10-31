import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/docs/docs.module.css";

export const metadata: Metadata = {
  title: "Skill 接入",
  description: "蜡笔猫导航的 Agent Skill 技能包（即将推出）。",
  alternates: { canonical: "/docs/skill" },
};

export default function SkillDocs() {
  return (
    <>
      <h1>Skill 接入</h1>
      <p className={styles.lead}>即将推出。</p>
      <p>
        我们会提供一个 Agent Skill 技能包（<code>SKILL.md</code>），装进支持 Agent Skills 的客户端后，Agent 就知道怎样在蜡笔猫导航里查资源：先看分类，再筛选，再看详情和快速上手。
      </p>
      <p>
        技能包底层调用 <Link href="/docs/api">HTTP API</Link>。现在想用的话，推荐先走 <Link href="/docs/mcp">MCP 接入</Link>。
      </p>
    </>
  );
}
