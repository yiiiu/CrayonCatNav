import Link from "next/link";
import { ResourceCard } from "@/components/resource/ResourceCard";
import styles from "@/components/resource/resource.module.css";
import { ButtonLink, Card, Mono, SearchBox, SectionHead } from "@/components/ui";
import { countPublished, listFeatured } from "@/lib/data/resource.repo";
import { listCategoriesWithCounts } from "@/lib/data/taxonomy.repo";
import { isPubliclyListed } from "@/lib/tools/metas";
import { toolRegistry } from "@/lib/tools/registry";

export default async function HomePage() {
  const [categories, featured, total] = await Promise.all([listCategoriesWithCounts(), listFeatured(6), countPublished()]);
  const tools = toolRegistry.filter(isPubliclyListed);

  return (
    <>
      <Card className={styles.hero}>
        <h1>找 AI 资源，顺手把活干完</h1>
        <SearchBox className={styles.heroSearch} />
        <p>
          收录 {total} 个精选 AI 资源 · {tools.length} 个浏览器本地工具
        </p>
      </Card>

      <section aria-labelledby="h-cat">
        <SectionHead id="h-cat" title="分类" note="按用途挑，一眼看完" />
        <div className={styles.tiles}>
          {categories.map((c) => (
            <Link key={c.id} href={`/resources?cat=${c.slug}`}>
              <Card interactive className={styles.tile}>
                <Mono name={c.name} accentKey={c.slug} />
                <span>
                  <b>{c.name}</b>
                  <small>{c._count.resources} 个资源</small>
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {featured.length > 0 && (
        <section aria-labelledby="h-feat">
          <SectionHead id="h-feat" title="精选资源" note="编辑推荐" />
          <div className={styles.cards}>
            {featured.map((r) => (
              <ResourceCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="h-tools">
        <SectionHead id="h-tools" title="在线工具" note="浏览器本地运行，不上传" />
        <div className={styles.tools}>
          {tools.map((t) => (
            <Card key={t.slug} className={styles.tool}>
              <h3>{t.name}</h3>
              <p>{t.description}</p>
              <ButtonLink href={`/tools/${t.slug}`} variant="primary">
                立即使用
              </ButtonLink>
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
