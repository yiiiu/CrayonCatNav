"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui";
import { DOC_PAGES } from "@/lib/docs/pages";
import styles from "./docs.module.css";

/** 文档左侧目录：当前页高亮，未上线的标「即将推出」。 */
export function DocsNav() {
  const pathname = usePathname();
  return (
    <Card className={styles.nav}>
      <nav aria-label="文档目录">
        <h2>接入文档</h2>
        <ul>
          {DOC_PAGES.map((p) => (
            <li key={p.href}>
              <Link href={p.href} aria-current={pathname === p.href ? "page" : undefined}>
                {p.title}
                {p.soon && <span className={styles.soon}>即将推出</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Card>
  );
}
