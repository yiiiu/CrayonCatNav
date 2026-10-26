import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { QuickStart } from "@/components/resource/QuickStart";
import { RelatedToolCTA } from "@/components/resource/RelatedToolCTA";
import { ResourceViewTracker } from "@/components/resource/ResourceViewTracker";
import styles from "@/components/resource/resource.module.css";
import { Breadcrumb, Card, Chip, ExternalButton, Mono, SectionHead } from "@/components/ui";
import { findPublishedBySlug, listPublishedSlugs, listRelatedPublished } from "@/lib/data/resource.repo";
import { slugSchema } from "@/lib/validation/common";
import { pricingLabels } from "@/lib/validation/resource";
import { hasDetails, platformLabels, readDetails } from "@/lib/validation/resource-details";

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
  const d = readDetails(r.details);
  const host = (u: string | null) => (u ? new URL(u).hostname.replace(/^www\./, "") : null);
  const repo = r.githubUrl ? r.githubUrl.replace(/^https:\/\/github\.com\//, "") : null;
  const pricing = [r.pricingType !== "unknown" ? pricingLabels[r.pricingType] : null, d.pricingNote || null].filter(Boolean).join(" · ");

  return (
    <article>
      <ResourceViewTracker slug={r.slug} />
      <Breadcrumb
        items={[
          { label: "发现", href: "/resources" },
          { label: r.category.name, href: `/resources?cat=${r.category.slug}` },
          { label: r.name },
        ]}
      />

      <Card className={`${styles.titlecard} ${r.previewImageUrl ? styles.withPreview : ""}`}>
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
        {r.previewImageUrl && (
          <a className={styles.preview} href={r.websiteUrl ?? r.githubUrl ?? undefined} target="_blank" rel="noopener noreferrer" aria-label={`访问 ${r.name} 官网`}>
            {/* 外站 og:image，尺寸不定，用原生 img 懒加载 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.previewImageUrl} alt={`${r.name} 官网预览`} loading="lazy" decoding="async" referrerPolicy="no-referrer" />
          </a>
        )}
      </Card>

      <div className={hasDetails(d) ? styles.detailGrid : undefined}>
        <div className={styles.detailMain}>
          {d.highlights.length > 0 && (
            <section aria-labelledby="h-hl">
              <SectionHead id="h-hl" title="它能做什么" />
              <ul className={styles.points}>
                {d.highlights.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          )}
          {d.useCases.length > 0 && (
            <section aria-labelledby="h-uc">
              <SectionHead id="h-uc" title="适合谁" />
              <ul className={styles.points}>
                {d.useCases.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </section>
          )}
          {d.quickstart && (
            <section aria-labelledby="h-qs">
              <SectionHead id="h-qs" title="快速上手" />
              <QuickStart code={d.quickstart} />
            </section>
          )}
          {paragraphs.length > 0 && (
            <section aria-labelledby="h-intro">
              <SectionHead id="h-intro" title={hasDetails(d) ? "详细介绍" : "介绍"} />
              <div className={styles.prose}>
                {paragraphs.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </section>
          )}
        </div>

        {hasDetails(d) && (
          <aside className={styles.facts} aria-label="基本信息">
            <Card>
              <dl>
                {r.websiteUrl && (
                  <>
                    <dt>官网</dt>
                    <dd><a href={r.websiteUrl} target="_blank" rel="noopener noreferrer">{host(r.websiteUrl)} ↗</a></dd>
                  </>
                )}
                {repo && (
                  <>
                    <dt>GitHub</dt>
                    <dd><a href={r.githubUrl!} target="_blank" rel="noopener noreferrer">{repo} ↗</a></dd>
                  </>
                )}
                {pricing && (
                  <>
                    <dt>定价</dt>
                    <dd>{pricing}</dd>
                  </>
                )}
                {d.platforms.length > 0 && (
                  <>
                    <dt>平台</dt>
                    <dd className={styles.plats}>
                      {d.platforms.map((p) => (
                        <Chip flat key={p}>{platformLabels[p]}</Chip>
                      ))}
                    </dd>
                  </>
                )}
                <dt>分类</dt>
                <dd><Link href={`/resources?cat=${r.category.slug}`}>{r.category.name}</Link></dd>
                <dt>更新</dt>
                <dd>{updated}</dd>
              </dl>
            </Card>
          </aside>
        )}
      </div>

      {r.tools.map(({ tool }) => (
        <RelatedToolCTA
          key={tool.id}
          toolSlug={tool.slug}
          resource={{ slug: r.slug, name: r.name, categorySlug: r.category.slug }}
        />
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
