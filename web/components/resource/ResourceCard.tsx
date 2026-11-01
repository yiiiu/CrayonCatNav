import Link from "next/link";
import { Card, Chip } from "@/components/ui";
import { cardTags, splitName } from "@/lib/resource/display";
import { ResourceLogo } from "./ResourceLogo";
import styles from "./resource.module.css";

/** 卡片需要的最少字段（列表页传完整记录，推荐结果传精简对象）。 */
export type ResourceCardView = {
  slug: string;
  name: string;
  summary: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  iconUrl?: string | null;
  category: { slug: string; name: string };
  tags: { tag: { id: string; name: string } }[];
};

/** 资源卡片：整卡链接到详情页；外链只在详情页出现，避免嵌套链接。 */
export function ResourceCard({ r, hideCategory = false }: { r: ResourceCardView; /** 已按分类筛选时不再重复显示分类 */ hideCategory?: boolean }) {
  const { title } = splitName(r.name);
  const tags = cardTags(
    r.tags.map(({ tag }) => tag),
    r.category.name,
    3,
  );
  return (
    <Link href={`/resources/${r.slug}`} className={styles.cardLink}>
      <Card interactive>
        <div className={styles.cardTop}>
          <ResourceLogo name={title} accentKey={r.category.slug + r.slug} iconUrl={r.iconUrl} githubUrl={r.githubUrl} websiteUrl={r.websiteUrl} />
          <b title={title === r.name ? undefined : r.name}>{title}</b>
        </div>
        <p className={styles.cardSummary}>{r.summary}</p>
        <div className={styles.tags}>
          {!hideCategory && (
            <Chip flat cat>
              {r.category.name}
            </Chip>
          )}
          {tags.map((tag) => (
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
