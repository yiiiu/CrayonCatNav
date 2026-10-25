"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";
import a from "./agent.module.css";

const items = [
  ["/admin/overview", "数据总览"],
  ["/admin/resources", "资源管理"],
  ["/admin/taxonomy", "分类标签"],
  ["/admin/featured", "首页精选"],
  ["/admin/agent", "采集 Agent"],
  ["/admin/candidates", "候选箱"],
] as const;

/** 后台导航；pending 为候选箱待审核数量（服务端查询后传入，0 或未传不显示徽标）。 */
export function AdminNav({ pending = 0 }: { pending?: number }) {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="后台导航">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
          {label}
          {href === "/admin/candidates" && pending > 0 && (
            <span className={a.count} aria-label={`${pending} 条待审核`}>
              {pending > 99 ? "99+" : pending}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
