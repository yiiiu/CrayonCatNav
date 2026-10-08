import { AdminTop } from "@/components/admin/AdminTop";
import styles from "@/components/admin/admin.module.css";
import { TaxonomyRow } from "@/components/admin/TaxonomyRow";
import { Card } from "@/components/ui";
import { adminListCategories, adminListTags } from "@/lib/data/taxonomy.repo";
import { deleteCategoryAction, deleteTagAction, saveCategoryAction, saveTagAction } from "../actions";

export const metadata = { title: "分类标签" };

export default async function TaxonomyPage() {
  const [categories, tags] = await Promise.all([adminListCategories(), adminListTags()]);
  return (
    <>
      <AdminTop title="分类标签" />
      <div className={styles.split}>
        <Card>
          <h2 className={styles.cardTitle}>分类（共 {categories.length} 个）</h2>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            名称 · slug · 排序（数字越小越靠前）。有资源的分类不能删除。
          </p>
          <div style={{ marginBottom: 12 }}>
            <TaxonomyRow key={`new-cat-${categories.length}`} kind="category" save={saveCategoryAction.bind(null, null)} />
          </div>
          <div className={styles.scrollRows} style={{ maxHeight: 480 }}>
            {categories.map((c) => (
              <TaxonomyRow
                key={`${c.id}-${c.slug}-${c.name}-${c.sortOrder}`}
                kind="category"
                initial={c}
                usage={c._count.resources}
                save={saveCategoryAction.bind(null, c.id)}
                remove={deleteCategoryAction.bind(null, c.id)}
              />
            ))}
          </div>
        </Card>
        <Card style={{ transform: "rotate(0.3deg)" }}>
          <h2 className={styles.cardTitle}>标签（共 {tags.length} 个）</h2>
          <p className={styles.hint} style={{ marginBottom: 12 }}>
            支持在列表内直接修改并保存，支持容器内纵向滚动：
          </p>
          <div style={{ marginBottom: 12 }}>
            <TaxonomyRow key={`new-tag-${tags.length}`} kind="tag" save={saveTagAction.bind(null, null)} />
          </div>
          <div className={styles.scrollRows} style={{ maxHeight: 480 }}>
            {tags.map((t) => (
              <TaxonomyRow
                key={`${t.id}-${t.slug}-${t.name}`}
                kind="tag"
                initial={t}
                usage={t._count.resources}
                save={saveTagAction.bind(null, t.id)}
                remove={deleteTagAction.bind(null, t.id)}
              />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
