/**
 * Token 成本估算：纯函数。单价口径为“每百万 Token”，价格由用户填写，不代表实时官方价。
 * 精度：内部用整数（单价 × 1e6 后的微单位）累加避免浮点误差；展示保留 4 位小数，四舍五入（half-up）。
 */

export const CURRENCIES = { USD: "$", CNY: "¥", EUR: "€" } as const;
export type Currency = keyof typeof CURRENCIES;

export function isCurrency(v: unknown): v is Currency {
  return typeof v === "string" && v in CURRENCIES;
}

export const LIMITS = {
  tokens: 1e12, // 单次 Token 上限
  price: 1e6, // 每百万 Token 单价上限
  requests: 1e9,
} as const;

export type CostRaw = { inPrice: string; outPrice: string; inTokens: string; outTokens: string; requests: string };
export type CostField = keyof CostRaw;
export type CostErrors = Partial<Record<CostField, string>>;

export type CostOk = {
  ok: true;
  perRequest: number;
  total: number;
  values: { inPrice: number; outPrice: number; inTokens: number; outTokens: number; requests: number };
};
export type CostResult = CostOk | { ok: false; errors: CostErrors };

const DECIMAL_RE = /^\d+(\.\d+)?$/;
const INT_RE = /^\d+$/;

function cleanNum(s: string) {
  return s.trim().replace(/[,，_\s]/g, "");
}

function parseField(raw: string, kind: "price" | "int", max: number, required: boolean): number | string {
  const s = cleanNum(raw);
  if (!s) return required ? "必填" : 0;
  if (s.startsWith("-")) return kind === "int" ? "请输入 ≥ 0 的整数" : "请输入 ≥ 0 的数字";
  if (kind === "int" && !INT_RE.test(s)) return "请输入 ≥ 0 的整数";
  if (kind === "price" && !DECIMAL_RE.test(s)) return "请输入 ≥ 0 的数字";
  if (kind === "price" && (s.split(".")[1]?.length ?? 0) > 6) return "单价最多 6 位小数";
  const n = Number(s);
  if (!Number.isFinite(n) || n > max) return `不能超过 ${max.toLocaleString("en-US")}`;
  return n;
}

/** 把十进制字符串单价转为“微单位”整数（× 1e6），避免 0.1 + 0.2 类误差 */
function toMicros(s: string): bigint {
  const [i, f = ""] = cleanNum(s || "0").split(".");
  return BigInt(i || "0") * BigInt(1_000_000) + BigInt((f + "000000").slice(0, 6));
}

export function estimate(raw: CostRaw): CostResult {
  const fields = {
    inPrice: parseField(raw.inPrice, "price", LIMITS.price, true),
    outPrice: parseField(raw.outPrice, "price", LIMITS.price, true),
    inTokens: parseField(raw.inTokens, "int", LIMITS.tokens, true),
    outTokens: parseField(raw.outTokens, "int", LIMITS.tokens, false),
    requests: parseField(raw.requests, "int", LIMITS.requests, true),
  };
  const errors: CostErrors = {};
  for (const [k, v] of Object.entries(fields)) if (typeof v === "string") errors[k as CostField] = v;
  if (Object.keys(errors).length) return { ok: false, errors };

  const values = fields as CostOk["values"];
  // 单次成本（微单位 × Token）：(inTokens × inPrice + outTokens × outPrice) / 1e6，再 / 1e6 还原微单位
  const perMicro =
    BigInt(values.inTokens) * toMicros(raw.inPrice) + BigInt(values.outTokens) * toMicros(raw.outPrice); // 单位：1e-12 货币
  const totalMicro = perMicro * BigInt(values.requests);
  const SCALE = 1_000_000_000_000; // 1e12
  return {
    ok: true,
    values,
    perRequest: Number(perMicro) / SCALE,
    total: Number(totalMicro) / SCALE,
  };
}

/** 保留 4 位小数，half-up；四舍五入后会变成 0 的正数显示为“< 0.0001” */
export function formatMoney(v: number, currency: Currency, digits = 4): string {
  const sym = CURRENCIES[currency];
  if (v > 0 && v < 0.5 * 10 ** -digits) return `< ${sym}${(10 ** -digits).toFixed(digits)}`;
  const factor = 10 ** digits;
  const rounded = Math.round((v + Number.EPSILON) * factor) / factor;
  return `${sym}${rounded.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

const fmtInt = (n: number) => n.toLocaleString("en-US");

export function formula(r: CostOk, raw: CostRaw, currency: Currency): string {
  const v = r.values;
  const p = (s: string) => cleanNum(s) || "0";
  return [
    `(${fmtInt(v.inTokens)} × ${p(raw.inPrice)} + ${fmtInt(v.outTokens)} × ${p(raw.outPrice)}) ÷ 1,000,000 = ${formatMoney(r.perRequest, currency)}`,
    `× ${fmtInt(v.requests)} 次 = ${formatMoney(r.total, currency)}`,
  ].join("\n");
}
