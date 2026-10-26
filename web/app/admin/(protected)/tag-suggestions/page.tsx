import Link from "next/link";
import { connection } from "next/server";
import { AdminTop } from "@/components/admin/AdminTop";
import styles from "@/components/admin/admin.module.css";
import a from "@/components/admin/agent.module.css";
import { Button, Card, ConfirmButton, ScrollArea, Select } from "@/components/ui";
import { allTagsForVocab, listOpenSuggestions } from "@/lib/data/tag-suggestion.repo";
import { acceptSuggestionAction, ignoreSuggestionAction, mergeSuggestionAction } from "../actions";

export const metadata = { title: "待定标签" };

/** 被提到这么多次及以上的待定词高亮，优先处理。 */
const HOT_HITS = 3;

type SP = Promise<Record<string, string | undefined>>;

/** 标签待定池：模型建议的新标签，启用 / 归到已有标签（记为别名） / 忽略。见 docs/spec/标签治理方案.md。 */
export default async function TagSuggestionsPage({ searchParams }: { searchParams: SP }) {
  await connection();
  const sp = await searchParams;
  const [items, tags] = await Promise.all([listOpenSuggestions(), allTagsForVocab()]);

  return (
    <>
      <AdminTop title="待定标签">
        <Link href="/admin/taxonomy">分类标签 ›</Link>
      </AdminTop>
      {sp.done && <p className={styles.ok} role="status">{sp.done.slice(0, 200)}</p>}
      {sp.error && <p className={styles.alert} role="alert">{sp.error.slice(0, 200)}</p>}
      <Card className={styles.fill}>
        <div className={styles.toolbar}>
          <h2 className={styles.cardTitle}>共 {items.length} 个待定</h2>
          <span className={styles.hint}>
            采集时模型只能用已有标签，缺的词会进这里。「归到」会把词记成目标标签的别名，以后自动映射；「忽略」后不再推送。
          </span>
        </div>
        <ScrollArea className={`${styles.scroll} ${styles.body}`} viewportClassName={a.list}>
          {items.length === 0 && <p className={styles.muted}>没有待定标签</p>}
          {items.map((s) => (
            <div key={s.id} className={a.sugRow}>
              <div>
                <span className={a.sugName}>{s.name}</span>
                <div className={a.sugMeta}>
                  <span>slug：{s.slug}</span>
                  <span className={s.hits >= HOT_HITS ? a.sugHot : undefined}>被提 {s.hits} 次</span>
                  <span>来自 {new Set(s.candidateIds).size} 条候选</span>
                </div>
              </div>
              <div className={a.sugActs}>
                <form action={acceptSuggestionAction.bind(null, s.id)}>
                  <Button type="submit" variant="primary">启用</Button>
                </form>
                <form action={mergeSuggestionAction.bind(null, s.id)}>
                  <label htmlFor={`merge-${s.id}`} className="sr-only">归到哪个标签</label>
                  <Select
                    id={`merge-${s.id}`}
                    className={a.sugPick}
                    name="tagId"
                    required
                    searchable
                    searchPlaceholder="搜索标签…"
                    placeholder="归到…"
                    options={tags.map((t) => ({ value: t.id, label: t.name }))}
                  />
                  <Button type="submit">归到</Button>
                </form>
                <form action={ignoreSuggestionAction.bind(null, s.id)}>
                  <ConfirmButton className={styles.linkBtn} title="忽略待定标签" message={`忽略「${s.name}」？以后模型再提这个词会直接丢弃。`} confirmText="忽略">
                    忽略
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </ScrollArea>
      </Card>
    </>
  );
}
