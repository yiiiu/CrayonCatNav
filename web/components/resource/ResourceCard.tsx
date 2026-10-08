import Link from "next/link";
import { Card, Chip, Mono } from "@/components/ui";
import type { ResourceCardData } from "@/lib/data/resource.repo";
import styles from "./resource.module.css";

/** 资源卡片：整卡链接到详情页；外链只在详情页出现，避免嵌套链接。 */
export function ResourceCard({ r }: { r: ResourceCardData }) {
  return (
    <Link href={`/resources/${r.slug}`} className={styles.cardLink}>
      <Card interactive>
        <div className={styles.cardTop}>
          <Mono name={r.name} accentKey={r.category.slug + r.slug} />
          <b>{r.name}</b>
        </div>
        <p className={styles.cardSummary}>{r.summary}</p>
        <div className={styles.tags}>
          <Chip flat cat>
            {r.category.name}
          </Chip>
          {r.tags.slice(0, 4).map(({ tag }) => (
            <Chip flat key={tag.id}>
              {tag.name}
            </Chip>
          ))}
        </div>
        {(r.websiteUrl || r.githubUrl) && (
          <div className={styles.linkline} aria-hidden="true">
            {r.websiteUrl && <span>官网 ↗</span>}
            {r.githubUrl && <span>GitHub ↗</span>}
          </div>
        )}
      </Card>
    </Link>
  );
}
