"use client";

import { useId, useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  CURRENCIES,
  estimate,
  formatMoney,
  formula,
  isCurrency,
  type CostField,
  type CostRaw,
  type Currency,
} from "@/lib/tools/token-cost/logic";
import { useCopy } from "./shared";
import styles from "./tool.module.css";

const INITIAL: CostRaw = { inPrice: "3", outPrice: "15", inTokens: "1200", outTokens: "800", requests: "1000" };

type FieldDef = { key: CostField; label: string; sub?: string; unit?: "price" | "次"; placeholder: string };

const FIELDS: FieldDef[] = [
  { key: "inPrice", label: "输入单价", sub: "每百万 Token", unit: "price", placeholder: "例如 3" },
  { key: "outPrice", label: "输出单价", sub: "每百万 Token", unit: "price", placeholder: "例如 15" },
  { key: "inTokens", label: "输入 Token", placeholder: "例如 1200" },
  { key: "outTokens", label: "输出 Token", placeholder: "例如 800" },
];

/** 按用户填写的单价实时估算；价格不是实时官方价，全部本地计算。 */
export default function TokenCostTool() {
  const [currency, setCurrency] = useState<Currency>("USD");
  const [raw, setRaw] = useState<CostRaw>(INITIAL);
  const [touched, setTouched] = useState<Partial<Record<CostField, boolean>>>({});
  const { copy, node: toast } = useCopy();
  const uid = useId();

  const r = estimate(raw);
  const errors = r.ok ? {} : r.errors;
  const sym = CURRENCIES[currency];
  /** 非空的非法值立即提示；空的必填项在离开输入框后才提示 */
  const errFor = (k: CostField) => (touched[k] || raw[k] !== "" ? errors[k] : undefined);

  const set = (k: CostField) => (e: React.ChangeEvent<HTMLInputElement>) => setRaw((s) => ({ ...s, [k]: e.target.value }));
  const blur = (k: CostField) => () => setTouched((t) => ({ ...t, [k]: true }));

  function field(def: FieldDef) {
    const id = `${uid}-${def.key}`;
    const err = errFor(def.key);
    const unit = def.unit === "price" ? sym : def.unit;
    return (
      <div key={def.key} className={`${styles.field} ${err ? styles.bad : ""}`}>
        <label htmlFor={id}>
          {def.label} {def.sub ? <small>{def.sub}</small> : null}
        </label>
        <span className={styles.unit}>
          <input
            id={id}
            className={styles.input}
            inputMode={def.unit === "price" ? "decimal" : "numeric"}
            value={raw[def.key]}
            placeholder={def.placeholder}
            autoComplete="off"
            aria-invalid={err ? true : undefined}
            aria-describedby={err ? `${id}-err` : undefined}
            onChange={set(def.key)}
            onBlur={blur(def.key)}
          />
          {unit ? <em aria-hidden="true">{unit}</em> : null}
        </span>
        {err ? <p className={styles.err} id={`${id}-err`}>{err}</p> : null}
      </div>
    );
  }

  const text = r.ok ? formula(r, raw, currency) : "";
  const copyAll = r.ok
    ? `单次 ${formatMoney(r.perRequest, currency)}，总计 ${formatMoney(r.total, currency)}（${r.values.requests.toLocaleString("en-US")} 次）\n${text}\n单价为手动填写，非实时官方价格`
    : "";

  return (
    <div className={styles.cols}>
      <Card className={styles.card}>
        <h2>填写参数</h2>
        <div className={styles.field}>
          <label htmlFor={`${uid}-cur`}>币种</label>
          <select
            id={`${uid}-cur`}
            className={styles.input}
            value={currency}
            onChange={(e) => isCurrency(e.target.value) && setCurrency(e.target.value)}
          >
            {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
              <option key={c} value={c}>
                {c}（{CURRENCIES[c]}）
              </option>
            ))}
          </select>
        </div>
        <div className={styles.g2}>{FIELDS.map(field)}</div>
        {field({ key: "requests", label: "请求次数", unit: "次", placeholder: "例如 1000" })}
        <div className={styles.acts}>
          <Button
            onClick={() => {
              setRaw({ inPrice: "", outPrice: "", inTokens: "", outTokens: "", requests: "" });
              setTouched({});
            }}
          >
            清空
          </Button>
        </div>
      </Card>

      <div className={styles.stack}>
        <Card className={styles.card} aria-live="polite">
          <h2>费用结果</h2>
          <div className={`${styles.big} ${r.ok ? "" : styles.none}`}>
            <div>
              <b>{r.ok ? formatMoney(r.perRequest, currency) : "—"}</b>
              <span>单次</span>
            </div>
            <div>
              <b>{r.ok ? formatMoney(r.total, currency) : "—"}</b>
              <span>总计{r.ok ? ` · ${r.values.requests.toLocaleString("en-US")} 次` : ""}</span>
            </div>
          </div>
          {r.ok ? (
            <>
              <pre className={`${styles.code} ${styles.wrap}`} aria-label="计算公式">{text}</pre>
              <div className={styles.acts}>
                <Button variant="primary" onClick={() => copy(copyAll)}>
                  复制结果
                </Button>
              </div>
            </>
          ) : (
            <p className={styles.status}>{Object.values(raw).every((v) => !v) ? "填写参数后自动计算" : "请先修正输入"}</p>
          )}
          <p className={styles.fineprint}>
            单价由你填写，并非实时官方价格 · 按每百万 Token 计价 · 保留 4 位小数，四舍五入
          </p>
        </Card>
      </div>
      {toast}
    </div>
  );
}
