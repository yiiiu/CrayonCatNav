import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Container } from "@/components/layout/Container";
import { requireAdmin } from "@/lib/auth/require-admin";

export const metadata: Metadata = { robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <nav aria-label="后台导航" style={{ display: "flex", gap: "var(--sp-5)", fontWeight: 800 }}>
        <Link href="/admin/resources">资源</Link>
        <Link href="/admin/taxonomy">分类标签</Link>
        <Link href="/admin/featured">首页精选</Link>
      </nav>
      <Suspense fallback={<p>校验身份中…</p>}>
        <AdminGate>{children}</AdminGate>
      </Suspense>
    </Container>
  );
}

/** 服务端校验会话 + Admin 表，未通过直接 redirect。 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return <main style={{ marginTop: "var(--sp-6)" }}>{children}</main>;
}
