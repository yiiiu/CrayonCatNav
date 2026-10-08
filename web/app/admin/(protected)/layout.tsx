import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import styles from "@/components/admin/admin.module.css";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: { default: "后台", template: "%s｜蜡笔猫后台" }, robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <div className={styles.shell}>
        <Card className={styles.side}>
          <div className={styles.brand}>
            <Image className={styles.logo} src="/cat-logo.png" alt="蜡笔猫标志" width={40} height={40} />
            <span>蜡笔猫后台</span>
          </div>
          <Suspense>
            <AdminNav />
          </Suspense>
          <div className={styles.bottom}>
            <a href="/" target="_blank" rel="noopener noreferrer">
              查看前台 ↗
            </a>
            <form action={logoutAction}>
              <button type="submit">退出登录</button>
            </form>
          </div>
        </Card>
        <Suspense fallback={<p>校验身份中…</p>}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </div>
    </Container>
  );
}

/** 服务端校验会话 + Admin 表，未通过直接 redirect。 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection(); // 后台页面一律请求时渲染，不参与预渲染
  await requireAdmin();
  return <main className={styles.pane}>{children}</main>;
}
