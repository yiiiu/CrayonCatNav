import Link from "next/link";
import { Card, Chip, Mono } from "@/components/ui";
import styles from "./resource.module.css";

/** 卡片需要的最少字段（列表页传完整记录，推荐结果传精简对象）。 */
export type ResourceCardView = {
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  category: { slug: string; name: string };
  tags: { tag: { id: string; name: string } }[];
};

/** 资源卡片：整卡链接到详情页；外链只在详情页出现，避免嵌套链接。 */
export function ResourceCard({ r }: { r: ResourceCardView }) {
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
