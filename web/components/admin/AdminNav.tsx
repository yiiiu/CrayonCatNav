"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./admin.module.css";

const items = [
  ["/admin/overview", "数据总览"],
  ["/admin/resources", "资源管理"],
  ["/admin/taxonomy", "分类标签"],
  ["/admin/featured", "首页精选"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className={styles.nav} aria-label="后台导航">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
