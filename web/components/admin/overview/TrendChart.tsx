import type { DayPoint } from "@/lib/data/analytics.repo";
import { niceMax } from "@/lib/ui/chart";
import styles from "./overview.module.css";

const W = 640;
const H = 220;
const P = { l: 40, r: 14, t: 14, b: 28 };

/** 手绘风 PV / UV 折线图：纯 SVG，服务端渲染，无图表依赖。附带读屏用数据表。 */
export function TrendChart({ series }: { series: DayPoint[] }) {
  const max = niceMax(Math.max(1, ...series.map((p) => Math.max(p.pv, p.uv))));
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const x = (i: number) => P.l + (series.length <= 1 ? iw / 2 : (i / (series.length - 1)) * iw);
  const y = (v: number) => P.t + ih - (v / max) * ih;
  const line = (k: "pv" | "uv") => series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ");
  const area = `${line("pv")} L${x(series.length - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const total = series.reduce((a, p) => a + p.pv, 0);

  return (
    <figure className={styles.chart}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`近 ${series.length} 天浏览量趋势，共 ${total} 次浏览`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className={styles.grid} />
            <text x={P.l - 8} y={y(t) + 4} textAnchor="end" className={styles.axis}>{t}</text>
          </g>
        ))}
        {series.map((p, i) =>
          i % 5 === 0 || i === series.length - 1 ? (
            <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" className={styles.axis}>{p.date.slice(5)}</text>
          ) : null,
        )}
        <path d={area} className={styles.area} />
        <path d={line("uv")} className={`${styles.line} ${styles.uv}`} />
        <path d={line("pv")} className={`${styles.line} ${styles.pv}`} />
        {series.map((p, i) => (
          <circle key={p.date} cx={x(i)} cy={y(p.pv)} r={i === series.length - 1 ? 4.5 : 3} className={styles.dot}>
            <title>{`${p.date}：浏览 ${p.pv}，访客 ${p.uv}`}</title>
          </circle>
        ))}
      </svg>
      <figcaption className={styles.legend}>
        <span><i className={styles.kPv} />浏览量 PV</span>
        <span><i className={styles.kUv} />独立访客 UV</span>
      </figcaption>
      <table className="sr-only">
        <caption>每日浏览量与独立访客</caption>
        <thead><tr><th scope="col">日期</th><th scope="col">PV</th><th scope="col">UV</th></tr></thead>
        <tbody>{series.map((p) => <tr key={p.date}><th scope="row">{p.date}</th><td>{p.pv}</td><td>{p.uv}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}
