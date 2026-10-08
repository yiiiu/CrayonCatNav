import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RelatedToolCTA } from "@/components/resource/RelatedToolCTA";
import styles from "@/components/resource/resource.module.css";
import { Card, Chip, ExternalButton, Mono, SectionHead } from "@/components/ui";
import { findPublishedBySlug, listPublishedSlugs, listRelatedPublished } from "@/lib/data/resource.repo";
import { slugSchema } from "@/lib/validation/common";
import { pricingLabels } from "@/lib/validation/resource";

type Props = { params: Promise<{ slug: string }> };

/** proxy.ts 把不存在/未发布的 slug 改写到这里；它必须在构建期预渲染成 404，首个请求才不会走流式外壳返回 200。 */
const NOT_FOUND_SLUG = "__none__";

/** 预渲染最近更新的资源 + 404 占位；其余已发布 slug 首次访问时渲染并缓存。 */
export async function generateStaticParams() {
  let rows: { slug: string }[] = [];
  try {
    rows = await listPublishedSlugs(50);
  } catch {
    // 构建期无数据库：只预渲染 404 占位
  }
  return [...rows.map((r) => ({ slug: r.slug })), { slug: NOT_FOUND_SLUG }];
}

async function load(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null; // 非法 slug 不查库
  return findPublishedBySlug(slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const r = await load((await params).slug);
  if (!r) return { title: "资源不存在", robots: { index: false } };
  return {
    title: r.name,
    description: r.summary,
    alternates: { canonical: `/resources/${r.slug}` },
    openGraph: { title: r.name, description: r.summary, type: "article" },
  };
}

/** params 在 Suspense 外 await：未发布/不存在的 slug 返回真实 404 状态码。 */
export default async function ResourceDetailPage({ params }: Props) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const related = await listRelatedPublished(r.categoryId, r.id);
  const paragraphs = r.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const updated = r.updatedAt.toISOString().slice(0, 10);

  return (
    <article>
      <nav aria-label="面包屑">
        <p className={styles.crumb}>
          <Link href="/resources">发现</Link> › <Link href={`/resources?cat=${r.category.slug}`}>{r.category.name}</Link> › {r.name}
        </p>
      </nav>

      <Card className={styles.titlecard}>
        <Mono name={r.name} accentKey={r.category.slug + r.slug} size="lg" />
        <div className={styles.tbody}>
          <h1>{r.name}</h1>
          <p>{r.summary}</p>
          <div className={styles.tags}>
            <Chip flat cat>{r.category.name}</Chip>
            {r.pricingType !== "unknown" && <Chip flat>{pricingLabels[r.pricingType]}</Chip>}
            {r.tags.map(({ tag }) => (
              <Chip flat key={tag.id}>{tag.name}</Chip>
            ))}
          </div>
          <div className={styles.acts}>
            {r.websiteUrl && <ExternalButton href={r.websiteUrl} variant="primary">官网</ExternalButton>}
            {r.githubUrl && <ExternalButton href={r.githubUrl}>GitHub</ExternalButton>}
            <time className={styles.updated} dateTime={r.updatedAt.toISOString()}>
              更新于 {updated}
            </time>
          </div>
        </div>
      </Card>

      {paragraphs.length > 0 && (
        <section aria-labelledby="h-intro">
          <SectionHead id="h-intro" title="介绍" />
          <div className={styles.prose}>
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </section>
      )}

      {r.tools.map(({ tool }) => (
        <RelatedToolCTA key={tool.id} toolSlug={tool.slug} />
      ))}

      {related.length > 0 && (
        <section aria-labelledby="h-related">
          <SectionHead id="h-related" title="相关资源" />
          <div className={styles.grid3}>
            {related.map((x) => (
              <Link key={x.id} href={`/resources/${x.slug}`}>
                <Card interactive className={styles.mini}>
                  <Mono name={x.name} accentKey={x.category.slug + x.slug} />
                  <span>
                    <b>{x.name}</b>
                    <small>{x.category.name}</small>
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
