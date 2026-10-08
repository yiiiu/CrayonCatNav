import type { Metadata } from "next";
import Link from "next/link";
import { Card } from "@/components/ui";
import { isPubliclyListed } from "@/lib/tools/metas";
import { toolRegistry } from "@/lib/tools/registry";

export const metadata: Metadata = { title: "工具箱", alternates: { canonical: "/tools" } };

/** 工具中心：注册表 ∩ Tool.status=enabled（运营状态在内容闭环阶段接入）。 */
export default function ToolsPage() {
  const tools = toolRegistry.filter(isPubliclyListed).toSorted((a, b) => a.sortOrder - b.sortOrder);
  return (
    <>
      <h1>工具箱</h1>
      <div style={{ display: "grid", gap: "var(--sp-5)", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {tools.map((t) => (
          <Link key={t.slug} href={`/tools/${t.slug}`}>
            <Card interactive>
              <h2 style={{ margin: 0, fontSize: "var(--fs-lg)" }}>{t.name}</h2>
              <p style={{ color: "var(--ink-2)", fontSize: "var(--fs-sm)" }}>{t.description}</p>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
