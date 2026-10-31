import { DocsNav } from "@/components/docs/DocsNav";
import styles from "@/components/docs/docs.module.css";
import { Card } from "@/components/ui";

/** 文档中心：左侧目录 + 右侧正文（docs/spec/Agent接入方案.md §7）。 */
export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.layout}>
      <DocsNav />
      <Card className={styles.article}>
        <article>{children}</article>
      </Card>
    </div>
  );
}
