import Link from "next/link";
import { ButtonLink, Card, ChipLink, ScrollArea } from "@/components/ui";
import { splitTags } from "@/lib/resource/display";
import { buildSearchHref, type PublicSearchParams } from "@/lib/validation/search";
import styles from "./resource.module.css";

type Props = {
  current: PublicSearchParams;
  categories: { slug: string; name: string; _count: { resources: number } }[];
  tags: { slug: string; name: string }[];
};

/** 侧栏筛选：全部用链接实现，URL 即状态、可分享、无需 JS。 */
export function ResourceFilters({ current, categories, tags }: Props) {
  const { shown, more } = splitTags(tags, current.tag, 12);
  const { shown: shownCats, more: moreCats } = splitTags(categories, current.cat, 12);
  const catItem = (c: Props["categories"][number]) => (
    <li key={c.slug}>
      <Link href={buildSearchHref(current, { cat: c.slug })} aria-current={current.cat === c.slug ? "page" : undefined}>
        {c.name}
        <small>{c._count.resources}</small>
      </Link>
    </li>
  );
  const tagChip = (t: { slug: string; name: string }) => {
    const on = current.tag === t.slug;
    return (
      <ChipLink key={t.slug} active={on} href={buildSearchHref(current, { tag: on ? undefined : t.slug })}>
        {t.name}
      </ChipLink>
    );
  };
  const hasFilter = Boolean(current.q || current.cat || current.tag || current.sort || current.price || current.platform);
  return (
    <Card className={styles.side}>
      <ScrollArea className={styles.sideScroll} viewportClassName={styles.sideInner}>
      <nav aria-labelledby="f-cat">
        <h2 id="f-cat">分类</h2>
        <ul className={styles.catList}>
          <li>
            <Link href={buildSearchHref(current, { cat: undefined })} aria-current={!current.cat ? "page" : undefined}>
              全部
            </Link>
          </li>
          {shownCats.map(catItem)}
        </ul>
        {moreCats.length > 0 && (
          <details className={styles.more}>
            <summary>更多分类（{moreCats.length}）</summary>
            <ul className={styles.catList}>{moreCats.map(catItem)}</ul>
          </details>
        )}
      </nav>
      {tags.length > 0 && (
        <div>
          <h2>标签</h2>
          <div className={styles.tagwrap}>{shown.map(tagChip)}</div>
          {more.length > 0 && (
            <details className={styles.more}>
              <summary>展开更多（{more.length}）</summary>
              <div className={styles.tagwrap}>{more.map(tagChip)}</div>
            </details>
          )}
        </div>
      )}
      {hasFilter && <ButtonLink href="/resources">清空筛选</ButtonLink>}
      </ScrollArea>
    </Card>
  );
}
