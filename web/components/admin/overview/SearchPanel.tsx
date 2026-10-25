import { Card } from "@/components/ui";
import { displayPage } from "@/lib/analytics/search-parse";
import type { SearchPanel as Panel } from "@/lib/data/search-console";
import { fmt } from "@/lib/ui/chart";
import styles from "./overview.module.css";

type Props = { title: string; panel: Panel; setup: React.ReactNode; note?: string };

/** GSC / Bing 卡片：已接入显示 28 天汇总 + Top 查询词 / 落地页；未接入或失败时友好降级。 */
export function SearchPanel({ title, panel, setup, note }: Props) {
  if (panel.state === "unconfigured") {
    return (
      <Card className={styles.card}>
        <h2 className={styles.h2}>{title}<span className={styles.badgeOff}>未接入</span></h2>
        <div className={styles.empty}>{setup}</div>
      </Card>
    );
  }
  if (panel.state === "error") {
    return (
      <Card className={styles.card}>
        <h2 className={styles.h2}>{title}<span className={styles.badgeWarn}>暂时取不到</span></h2>
        <p className={styles.empty}>{panel.message}。稍后刷新再试，其余数据不受影响。</p>
      </Card>
    );
  }
  const d = panel.data;
  return (
    <Card className={styles.card}>
      <h2 className={styles.h2}>
        {title}
        <span className={styles.range}>{d.start} ~ {d.end}</span>
      </h2>
      <dl className={styles.kpis4}>
        <div><dt>点击</dt><dd>{fmt(d.clicks)}</dd></div>
        <div><dt>曝光</dt><dd>{fmt(d.impressions)}</dd></div>
        <div><dt>CTR</dt><dd>{(d.ctr * 100).toFixed(1)}%</dd></div>
        <div><dt>平均排名</dt><dd>{d.position ? d.position.toFixed(1) : "—"}</dd></div>
      </dl>
      <SearchTable caption="Top 查询词" rows={d.queries.map((r) => ({ ...r, label: r.key }))} />
      <SearchTable caption="Top 落地页" rows={d.pages.map((r) => ({ ...r, label: displayPage(r.key) }))} mono />
      {note ? <p className={styles.foot}>{note}</p> : null}
    </Card>
  );
}

function SearchTable({
  caption,
  rows,
  mono,
}: {
  caption: string;
  rows: { label: string; clicks: number; impressions: number; ctr: number; position: number }[];
  mono?: boolean;
}) {
  return (
    <div className={styles.tblWrap}>
      <table className={styles.tbl}>
        <caption>{caption}</caption>
        <thead>
          <tr><th scope="col">{mono ? "页面" : "查询词"}</th><th scope="col">点击</th><th scope="col">曝光</th><th scope="col">CTR</th><th scope="col">排名</th></tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={5} className={styles.emptyCell}>这段时间还没有数据</td></tr>
          ) : (
            rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className={mono ? styles.mono : undefined} title={r.label}>{r.label}</th>
                <td>{fmt(r.clicks)}</td>
                <td>{fmt(r.impressions)}</td>
                <td>{(r.ctr * 100).toFixed(1)}%</td>
                <td>{r.position ? r.position.toFixed(1) : "—"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
