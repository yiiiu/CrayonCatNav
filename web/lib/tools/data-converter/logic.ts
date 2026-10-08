import { parse as parseToml, stringify as stringifyToml, TomlDate, TomlError } from "smol-toml";
import { parseDocument, stringify as stringifyYaml, YAMLParseError } from "yaml";

/**
 * JSON / YAML / TOML 互转：纯函数，零 DOM 依赖，全部在浏览器本地运行。
 * 流程：解析源文本 → 归一化为 JSON 数据模型（记录有损点）→ 序列化为目标格式。
 */

export const FORMATS = ["json", "yaml", "toml"] as const;
export type DataFormat = (typeof FORMATS)[number];

export const FORMAT_LABEL: Record<DataFormat, string> = { json: "JSON", yaml: "YAML", toml: "TOML" };
export const FORMAT_EXT: Record<DataFormat, string> = { json: "json", yaml: "yaml", toml: "toml" };

export function isDataFormat(v: unknown): v is DataFormat {
  return typeof v === "string" && (FORMATS as readonly string[]).includes(v);
}

/** 单次转换的输入上限（字符数），防止粘贴超大文本卡死页面 */
export const MAX_INPUT = 500_000;

export type ParseFailure = { line?: number; column?: number; message: string };

export type ConvertResult =
  | { ok: true; output: string; keyCount: number; warnings: string[] }
  | { ok: false; error: ParseFailure };

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

/* ---------------- 解析 ---------------- */

function lineColFromOffset(text: string, offset: number) {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split("\n");
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

const JSON_HINTS: [RegExp, string][] = [
  [/Expected ',' or '}'/i, "对象成员之间缺少逗号，或多了一个字符"],
  [/Expected ',' or ']'/i, "数组元素之间缺少逗号，或多了一个字符"],
  [/Expected double-quoted property name/i, "键名需要双引号，或对象末尾多了逗号"],
  [/Unexpected end of JSON input/i, "内容不完整，可能缺少右括号或引号"],
  [/Bad control character/i, "字符串中含有未转义的换行或控制字符"],
  [/Unexpected token/i, "出现了不符合 JSON 语法的字符"],
  [/Unterminated string/i, "字符串缺少结尾的双引号"],
];

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    let line: number | undefined;
    let column: number | undefined;
    const lc = raw.match(/line (\d+) column (\d+)/i);
    const pos = raw.match(/position (\d+)/i);
    if (lc) {
      line = Number(lc[1]);
      column = Number(lc[2]);
    } else if (pos) {
      ({ line, column } = lineColFromOffset(text, Number(pos[1])));
    } else if (/Unexpected end of JSON input/i.test(raw)) {
      ({ line, column } = lineColFromOffset(text, text.trimEnd().length));
    }
    const hint = JSON_HINTS.find(([re]) => re.test(raw))?.[1] ?? "JSON 语法错误";
    throw { line, column, message: hint } satisfies ParseFailure;
  }
}

function parseYaml(text: string, warnings: string[]): unknown {
  const doc = parseDocument(text, { uniqueKeys: true });
  const err = doc.errors[0];
  if (err) {
    const pos = err instanceof YAMLParseError ? err.linePos?.[0] : undefined;
    const message = /keys must be unique/i.test(err.message) ? "存在重复的键" : err.message.split(" at line")[0];
    throw { line: pos?.line, column: pos?.col, message } satisfies ParseFailure;
  }
  if (/(^|[\s:[,-])&[\w-]+/m.test(text) && /(^|[\s:[,-])\*[\w-]+/m.test(text)) warnings.push("YAML 锚点与别名已展开为实际值，引用关系不会保留。");
  return doc.toJS({ maxAliasCount: 1000 });
}

function parseTomlText(text: string): unknown {
  try {
    return parseToml(text, { integersAsBigInt: "asNeeded" });
  } catch (e) {
    if (e instanceof TomlError) {
      const first = e.message.split("\n")[0].replace(/^Invalid TOML document:\s*/i, "");
      throw { line: e.line, column: e.column, message: first } satisfies ParseFailure;
    }
    throw { message: e instanceof Error ? e.message : String(e) } satisfies ParseFailure;
  }
}

/* ---------------- 归一化（记录有损点） ---------------- */

type Loss = { dates: number; bigints: number; nonFinite: number };

function normalize(v: unknown, loss: Loss): Json {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean" || typeof v === "string") return v;
  if (typeof v === "number") {
    if (!Number.isFinite(v)) {
      loss.nonFinite++;
      return Number.isNaN(v) ? "NaN" : v > 0 ? "Infinity" : "-Infinity";
    }
    return v;
  }
  if (typeof v === "bigint") {
    loss.bigints++;
    return v.toString();
  }
  if (v instanceof TomlDate) {
    loss.dates++;
    return v.toISOString();
  }
  if (v instanceof Date) {
    loss.dates++;
    return v.toISOString();
  }
  if (Array.isArray(v)) return v.map((x) => normalize(x, loss));
  if (v instanceof Map) {
    const o: Record<string, Json> = {};
    for (const [k, val] of v) o[String(k)] = normalize(val, loss);
    return o;
  }
  if (typeof v === "object") {
    const o: Record<string, Json> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) o[k] = normalize(val, loss);
    return o;
  }
  return String(v);
}

/** TOML 没有 null：对象里的 null 字段省略；数组里的 null 无法表示，直接报错。 */
function stripNullsForToml(v: Json, path: string, dropped: string[]): Json {
  if (Array.isArray(v)) {
    return v.map((x, i) => {
      if (x === null) throw { message: `TOML 不支持 null，数组元素 ${path || "根"}[${i}] 无法转换` } satisfies ParseFailure;
      return stripNullsForToml(x, `${path}[${i}]`, dropped);
    });
  }
  if (v && typeof v === "object") {
    const o: Record<string, Json> = {};
    for (const [k, val] of Object.entries(v)) {
      const p = path ? `${path}.${k}` : k;
      if (val === null) dropped.push(p);
      else o[k] = stripNullsForToml(val, p, dropped);
    }
    return o;
  }
  return v;
}

/* ---------------- 对外入口 ---------------- */

export function hasComments(text: string, from: DataFormat): boolean {
  if (from === "json") return false;
  // 行首或空白后的 #（粗略判断，字符串里的 # 可能误报，因此提示措辞为“可能”）
  return /(^|\s)#/m.test(text);
}

export function convert(text: string, from: DataFormat, to: DataFormat): ConvertResult {
  if (!text.trim()) return { ok: false, error: { message: "请先输入要转换的内容" } };
  if (text.length > MAX_INPUT) return { ok: false, error: { message: `输入过长（上限 ${MAX_INPUT.toLocaleString()} 字符）` } };

  const warnings: string[] = [];
  try {
    const parsed = from === "json" ? parseJson(text) : from === "yaml" ? parseYaml(text, warnings) : parseTomlText(text);
    const loss: Loss = { dates: 0, bigints: 0, nonFinite: 0 };
    let data = normalize(parsed, loss);

    if (from !== to && hasComments(text, from)) warnings.push(`${FORMAT_LABEL[from]} 注释不会保留到输出中。`);
    if (loss.dates && to !== "toml") warnings.push(`${loss.dates} 个日期/时间值已转为 ISO 字符串，类型信息丢失。`);
    if (loss.dates && to === "toml") warnings.push(`${loss.dates} 个日期/时间值以字符串形式输出，不再是 TOML 日期类型。`);
    if (loss.bigints) warnings.push(`${loss.bigints} 个超出安全范围的大整数已转为字符串，避免精度丢失。`);
    if (loss.nonFinite) warnings.push(`${loss.nonFinite} 个 inf/nan 数值无法用 JSON 表示，已转为字符串。`);

    let output: string;
    if (to === "json") {
      output = JSON.stringify(data, null, 2);
    } else if (to === "yaml") {
      output = stringifyYaml(data, { lineWidth: 0 }).replace(/\n$/, "");
    } else {
      if (data === null || typeof data !== "object" || Array.isArray(data)) {
        return { ok: false, error: { message: "TOML 顶层必须是键值表（对象），当前内容是数组或单个值" } };
      }
      const dropped: string[] = [];
      data = stripNullsForToml(data, "", dropped);
      if (dropped.length) {
        const shown = dropped.slice(0, 5).join("、") + (dropped.length > 5 ? ` 等 ${dropped.length} 个` : "");
        warnings.push(`TOML 不支持 null，${shown} 字段已省略。`);
      }
      output = stringifyToml(data).replace(/\n$/, "");
    }

    const keyCount = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).length : 0;
    return { ok: true, output, keyCount, warnings };
  } catch (e) {
    if (e && typeof e === "object" && "message" in e) return { ok: false, error: e as ParseFailure };
    return { ok: false, error: { message: "转换失败" } };
  }
}
