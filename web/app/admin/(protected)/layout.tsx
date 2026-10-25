import type { Metadata } from "next";
import Image from "next/image";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import styles from "@/components/admin/admin.module.css";
import { Card } from "@/components/ui";
import { auth } from "@/lib/auth/auth";
import { requireAdmin } from "@/lib/auth/require-admin";
import { countPending } from "@/lib/data/agent.repo";
import { logoutAction } from "./actions";

export const metadata: Metadata = { title: { default: "后台", template: "%s｜蜡笔猫后台" }, robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.viewport}>
      <div className={styles.shell}>
        <Card className={styles.side}>
          <div className={styles.brand}>
            <Image className={styles.logo} src="/cat-logo.png" alt="蜡笔猫标志" width={40} height={40} />
            <span>蜡笔猫后台</span>
          </div>
          {/* 徽标数量查询完成前先显示无徽标的导航（usePathname 需包在 Suspense 内） */}
          <Suspense
            fallback={
              <Suspense>
                <AdminNav />
              </Suspense>
            }
          >
            <NavWithBadge />
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
    </div>
  );
}

/** 导航 + 候选箱待审核数徽标：只有已登录会话才查询数量；查询失败不影响导航。 */
async function NavWithBadge() {
  await connection();
  const session = await auth();
  const pending = session?.user?.id ? await countPending().catch(() => 0) : 0;
  return <AdminNav pending={pending} />;
}

/** 服务端校验会话 + Admin 表，未通过直接 redirect。 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await connection(); // 后台页面一律请求时渲染，不参与预渲染
  await requireAdmin();
  return <main className={styles.pane}>{children}</main>;
}
