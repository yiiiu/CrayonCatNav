import Link from "next/link";
import { Card } from "@/components/ui";
import { toolRegistry } from "@/lib/tools/registry";

/** 首页骨架：搜索、分类入口、精选资源将在内容闭环阶段接入数据。 */
export default function HomePage() {
  return (
    <>
      <Card>
        <h1 style={{ margin: 0 }}>发现好用的 AI 资源，顺手把它配好</h1>
        <form action="/resources" role="search" style={{ marginTop: "var(--sp-4)" }}>
          <label htmlFor="q" className="sr-only">搜索资源</label>
          <input id="q" name="q" placeholder="搜索 MCP、Skills、模型 API…" />
        </form>
      </Card>
      <section aria-labelledby="hot-tools" style={{ marginTop: "var(--sp-8)" }}>
        <h2 id="hot-tools">热门在线工具</h2>
        <ul>
          {toolRegistry.map((t) => (
            <li key={t.slug}>
              <Link href={`/tools/${t.slug}`}>{t.name}</Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
