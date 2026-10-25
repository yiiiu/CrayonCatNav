"use client";

import { useRef, useState } from "react";
import type { DayPoint } from "@/lib/data/analytics.repo";
import { dayLabel, fmt, nearestIndex, niceMax, stepIndex } from "@/lib/ui/chart";
import styles from "./overview.module.css";

const W = 640;
const H = 220;
const P = { l: 40, r: 14, t: 14, b: 28 };

/**
 * 手绘风 PV / UV 折线图：纯 SVG，无图表依赖。附带读屏用数据表。
 * 悬浮浮层：指针在绘图区任意位置都吸附到最近一天，显示竖向参考线、两点高亮和数据卡片；
 * 键盘聚焦后可用 ←/→/Home/End 逐日查看，Esc 收起；触屏点按即显示。
 */
export function TrendChart({ series }: { series: DayPoint[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const n = series.length;
  const max = niceMax(Math.max(1, ...series.map((p) => Math.max(p.pv, p.uv))));
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const x = (i: number) => P.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v: number) => P.t + ih - (v / max) * ih;
  const line = (k: "pv" | "uv") => series.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(p[k]).toFixed(1)}`).join(" ");
  const area = `${line("pv")} L${x(n - 1).toFixed(1)} ${y(0)} L${x(0).toFixed(1)} ${y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  const total = series.reduce((a, p) => a + p.pv, 0);

  const pick = (clientX: number) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const r = svg.getBoundingClientRect();
    if (r.width <= 0) return;
    setActive(nearestIndex(((clientX - r.left) / r.width) * W, P.l, iw, n));
  };

  const cur = active !== null && active < n ? series[active] : null;
  const cx = active !== null ? x(active) : 0;
  // 卡片默认在参考线右侧，后 40% 的点翻到左侧；纵向贴着较高的那个点，留在绘图区内
  const flip = active !== null && n > 1 && active / (n - 1) > 0.6;
  const top = cur ? Math.max(P.t, Math.min(y(Math.max(cur.pv, cur.uv)), P.t + ih - 70)) : 0;

  return (
    <figure className={styles.chart}>
      <div className={styles.plot}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={`近 ${n} 天浏览量趋势，共 ${total} 次浏览。聚焦后可用左右方向键逐日查看。`}
          tabIndex={0}
          className={styles.svgHit}
          onPointerMove={(e) => pick(e.clientX)}
          onPointerDown={(e) => pick(e.clientX)}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setActive(null); }}
          onFocus={() => setActive((a) => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setActive(null); return; }
            const next = stepIndex(e.key, active, n);
            if (next !== null) { e.preventDefault(); setActive(next); }
          }}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className={styles.grid} />
              <text x={P.l - 8} y={y(t) + 4} textAnchor="end" className={styles.axis}>{t}</text>
            </g>
          ))}
          {series.map((p, i) =>
            i % 5 === 0 || i === n - 1 ? (
              <text key={p.date} x={x(i)} y={H - 8} textAnchor="middle" className={styles.axis}>{p.date.slice(5)}</text>
            ) : null,
          )}
          <path d={area} className={styles.area} />
          {cur && <line x1={cx} x2={cx} y1={P.t} y2={P.t + ih} className={styles.guide} />}
          <path d={line("uv")} className={`${styles.line} ${styles.uv}`} />
          <path d={line("pv")} className={`${styles.line} ${styles.pv}`} />
          {series.map((p, i) => (
            <circle key={p.date} cx={x(i)} cy={y(p.pv)} r={i === n - 1 ? 4.5 : 3} className={styles.dot} />
          ))}
          {cur && (
            <g className={styles.hot}>
              <circle cx={cx} cy={y(cur.uv)} r={5.5} className={styles.hotUv} />
              <circle cx={cx} cy={y(cur.pv)} r={6} className={styles.hotPv} />
            </g>
          )}
        </svg>

        {cur && (
          <div
            className={`${styles.tip} ${flip ? styles.tipFlip : ""}`}
            style={{ left: `${(cx / W) * 100}%`, top: `${(top / H) * 100}%` }}
            aria-hidden="true"
          >
            <b>{dayLabel(cur.date)}</b>
            <span><i className={styles.kPv} />浏览量<em>{fmt(cur.pv)}</em></span>
            <span><i className={styles.kUv} />访客<em>{fmt(cur.uv)}</em></span>
          </div>
        )}
        <p className="sr-only" aria-live="polite">
          {cur ? `${dayLabel(cur.date)}：浏览 ${cur.pv}，访客 ${cur.uv}` : ""}
        </p>
      </div>
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
