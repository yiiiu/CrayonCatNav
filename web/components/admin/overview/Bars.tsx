import { fmt, percent } from "@/lib/ui/chart";
import styles from "./overview.module.css";

type Row = { key: string; label?: string; count: number };

const COLORS = ["var(--c-blue)", "var(--c-magenta)", "var(--c-yellow)", "var(--c-green)", "var(--c-orange)", "var(--c-purple)"];

/** 横向蜡笔条形图（列表语义，数值同时以文字给出）。 */
export function Bars({ rows, empty = "暂无数据", mono, total }: { rows: Row[]; empty?: string; mono?: boolean; total?: number }) {
  if (rows.length === 0) return <p className={styles.empty}>{empty}</p>;
  const max = Math.max(1, ...rows.map((r) => r.count));
  const sum = total ?? rows.reduce((a, r) => a + r.count, 0);
  return (
    <ol className={styles.bars}>
      {rows.map((r, i) => (
        <li key={r.key}>
          <span className={`${styles.barLabel} ${mono ? styles.mono : ""}`} title={r.label ?? r.key}>{r.label ?? r.key}</span>
          <span className={styles.barTrack} aria-hidden="true">
            <span className={styles.barFill} style={{ width: `${Math.max(3, (r.count / max) * 100)}%`, background: COLORS[i % COLORS.length] }} />
          </span>
          <span className={styles.barVal}>
            {fmt(r.count)}
            <small>{percent(r.count, sum)}%</small>
          </span>
        </li>
      ))}
    </ol>
  );
}
