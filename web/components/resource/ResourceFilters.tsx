import Link from "next/link";
import { ButtonLink, Card, ChipLink } from "@/components/ui";
import { platformLabels, platforms } from "@/lib/validation/resource-details";
import { buildSearchHref, type PublicSearchParams } from "@/lib/validation/search";
import styles from "./resource.module.css";

type Props = {
  current: PublicSearchParams;
  categories: { slug: string; name: string; _count: { resources: number } }[];
  tags: { slug: string; name: string }[];
};

/** 侧栏筛选：全部用链接实现，URL 即状态、可分享、无需 JS。 */
export function ResourceFilters({ current, categories, tags }: Props) {
  const hasFilter = Boolean(current.q || current.cat || current.tag || current.sort || current.price || current.platform);
  return (
    <Card className={styles.side}>
      <nav aria-labelledby="f-cat">
        <h2 id="f-cat">分类</h2>
        <ul className={styles.catList}>
          <li>
            <Link href={buildSearchHref(current, { cat: undefined })} aria-current={!current.cat ? "page" : undefined}>
              全部
            </Link>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <Link href={buildSearchHref(current, { cat: c.slug })} aria-current={current.cat === c.slug ? "page" : undefined}>
                {c.name}
                <small>{c._count.resources}</small>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div>
        <h2>平台</h2>
        <div className={styles.tagwrap}>
          {platforms.map((p) => {
            const on = current.platform === p;
            return (
              <ChipLink key={p} active={on} href={buildSearchHref(current, { platform: on ? undefined : p })}>
                {platformLabels[p]}
              </ChipLink>
            );
          })}
        </div>
      </div>
      {tags.length > 0 && (
        <div>
          <h2>标签</h2>
          <div className={styles.tagwrap}>
            {tags.map((t) => {
              const on = current.tag === t.slug;
              return (
                <ChipLink key={t.slug} active={on} href={buildSearchHref(current, { tag: on ? undefined : t.slug })}>
                  {t.name}
                </ChipLink>
              );
            })}
          </div>
        </div>
      )}
      {hasFilter && <ButtonLink href="/resources">清空筛选</ButtonLink>}
    </Card>
  );
}
