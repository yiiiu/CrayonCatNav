import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/components/tool/tool.module.css";
import { Card } from "@/components/ui";
import { isPubliclyListed } from "@/lib/tools/metas";
import { toolRegistry } from "@/lib/tools/registry";

export const metadata: Metadata = {
  title: "工具箱",
  description: "MCP 配置生成、JSON/YAML/TOML 转换、Token 成本估算，全部在浏览器本地运行。",
  alternates: { canonical: "/tools" },
};

const ICONS: Record<string, string> = { plug: "🔌", shuffle: "🔀", coins: "🪙" };

/** 工具中心：注册表 ∩ 公开状态，按 sortOrder 排序。 */
export default function ToolsPage() {
  const tools = toolRegistry.filter(isPubliclyListed).toSorted((a, b) => a.sortOrder - b.sortOrder);
  return (
    <>
      <header className={styles.thead}>
        <h1>工具箱</h1>
        <p>给 AI 开发者的小工具，打开即用。</p>
        <span className={styles.badge}>🔒 所有工具都在本地浏览器处理，不上传</span>
      </header>
      <div className={styles.grid}>
        {tools.map((t) => (
          <Link key={t.slug} href={`/tools/${t.slug}`}>
            <Card interactive className={styles.tcard}>
              <span className={styles.ticon} aria-hidden="true">{ICONS[t.icon] ?? "🧰"}</span>
              <h2>{t.name}</h2>
              <p>{t.description}</p>
              <span className={styles.go}>打开工具 →</span>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
