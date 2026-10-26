import Link from "next/link";
import { breadcrumbJsonLd, safeJson, type Crumb } from "@/lib/ui/breadcrumb";
import { siteConfig } from "@/lib/site";
import styles from "./Breadcrumb.module.css";

type Props = {
  /** 从上到下的层级；最后一项是当前页（不渲染链接，标 aria-current） */
  items: readonly Crumb[];
  /** 当前页后面的补充说明，如工具路径 /tools/xxx */
  extra?: React.ReactNode;
  /** 是否输出 BreadcrumbList 结构化数据（前台默认开，后台关） */
  jsonLd?: boolean;
  className?: string;
};

/** 手绘风面包屑：语义化 ol 列表 + 可选的 schema.org BreadcrumbList。 */
export function Breadcrumb({ items, extra, jsonLd = true, className }: Props) {
  const last = items.length - 1;
  return (
    <nav aria-label="面包屑" className={`${styles.crumb} ${className ?? ""}`}>
      <ol>
        {items.map((c, i) => (
          <li key={`${i}-${c.label}`}>
            {i === last ? (
              <span aria-current="page" className={styles.current}>
                {c.label}
              </span>
            ) : c.href ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span>{c.label}</span>
            )}
          </li>
        ))}
      </ol>
      {extra && <span className={styles.extra}>{extra}</span>}
      {jsonLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbJsonLd(items, siteConfig.url)) }} />
      )}
    </nav>
  );
}
