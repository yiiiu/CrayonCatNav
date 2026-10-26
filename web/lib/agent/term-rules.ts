import { hfTermSchema, keywordSchema, topicSchema } from "@/lib/validation/collect-config";

/**
 * 采集关键词扩词规则（规格 docs/spec/采集关键词AI扩词与来源扩展方案.md §4.3）。
 * 纯函数、不联网：模型只负责提候选，格式、去重、跨分类冲突、泛词和命中判定都在这里执行。
 */

export const TERM_RULES_VERSION = "2026-10-26.1";

export const termFields = ["githubTopics", "githubKeywords", "hfSearch"] as const;
export type TermField = (typeof termFields)[number];

export const termFieldLabels: Record<TermField, string> = {
  githubTopics: "GitHub 主题",
  githubKeywords: "GitHub 关键词",
  hfSearch: "HF Spaces 搜索词",
};

export const FIELD_LIMITS: Record<TermField, number> = { githubTopics: 8, githubKeywords: 4, hfSearch: 6 };

/** 写给模型的字段要求摘要（与 zod 校验一致）。 */
export const FIELD_RULE_TEXT: Record<TermField, string> = {
  githubTopics: "GitHub topic：只用小写英文字母、数字和连字符，≤50 字符，要是 GitHub 上真实常用的 topic 写法（如 mcp-server、text-to-image）",
  githubKeywords: "GitHub 搜索短语：英文为主，2–40 字符，可含空格，会在仓库名、简介、topics 中整句匹配（如 ai code review）",
  hfSearch: "Hugging Face Spaces 搜索词：2–40 位英文字母、数字和 . _ -，按 Space 名称（owner/name）做子串匹配，所以要短、要是常出现在 Space 名里的词（如 tts、flux）",
};

const SCHEMAS = { githubTopics: topicSchema, githubKeywords: keywordSchema, hfSearch: hfTermSchema } as const;

/** GitHub 命中数超过此值视为过泛（HF 接口最多返回 100 条，不判过泛）。 */
export const BROAD_HITS = 20_000;
/** 无 GitHub Token 时最多校验的候选数（搜索接口 10 次/分钟）。 */
export const MAX_UNAUTH_CHECKS = 8;
/** 一次最多展示的候选数。 */
export const MAX_SHOWN = 12;
const MIN_SHOWN = 6;

/** 单独出现时视为泛词（按归一化后的键比较）。 */
export const GENERIC_TERMS = [
  "ai", "llm", "llms", "ml", "tool", "tools", "app", "apps", "awesome", "awesome-list", "python", "javascript", "typescript",
  "react", "nodejs", "node", "api", "open-source", "opensource", "github", "machine-learning", "deep-learning", "artificial-intelligence",
  "chatgpt", "openai", "gpt", "demo", "test", "library", "framework", "project",
];

/** 比较用的键：小写，去掉空格、连字符、下划线和点（mcp-server ≈ MCP Server ≈ mcp_server）。 */
export function termKey(term: string): string {
  return term.trim().toLowerCase().replace(/[\s_.-]+/g, "");
}

const GENERIC_KEYS = new Set(GENERIC_TERMS.map(termKey));

/** 按字段把模型给的词整理成可用写法；不合法返回 null。 */
export function normalizeTerm(field: TermField, raw: string): string | null {
  let t = raw.trim().replace(/^#/, "");
  if (field === "githubTopics") t = t.toLowerCase().replace(/[\s_]+/g, "-");
  if (field === "githubKeywords") t = t.replace(/\s+/g, " ");
  const r = SCHEMAS[field].safeParse(t);
  return r.success ? r.data : null;
}

/** 字段剩余名额 × 2，夹在 6–12 之间。 */
export function candidateCap(field: TermField, existingCount: number): number {
  const remaining = Math.max(0, FIELD_LIMITS[field] - existingCount);
  return Math.min(MAX_SHOWN, Math.max(MIN_SHOWN, remaining * 2));
}

export type TermCandidate = { term: string; meaning: string; reason: string };
export type TermStatus = "ok" | "broad" | "blocked";
export type ClassifiedTerm = TermCandidate & {
  status: TermStatus;
  /** 不可用 / 过泛 / 未校验的说明 */
  note: string;
  /** 命中数；null = 未校验 */
  hits: number | null;
  /** 命中数是否被接口上限截断（HF 最多 100） */
  hitsCapped?: boolean;
};

export type ClassifyContext = {
  field: TermField;
  /** 本分类该字段已有的词（输入框里的当前值） */
  existing: readonly string[];
  /** 其他分类同字段已配置的词 */
  others: readonly { name: string; terms: readonly string[] }[];
};

/**
 * 第一轮：不联网的规则。格式不合法、空词与候选内部重复直接丢掉（不展示）；
 * 泛词、已在输入框、与其他分类重复标为不可用；其余待命中校验（hits = null）。
 */
export function classifyTerms(raw: readonly TermCandidate[], ctx: ClassifyContext): ClassifiedTerm[] {
  const existing = new Set(ctx.existing.map(termKey));
  const owner = new Map<string, string>();
  for (const o of ctx.others) for (const t of o.terms) if (!owner.has(termKey(t))) owner.set(termKey(t), o.name);
  const seen = new Set<string>();
  const out: ClassifiedTerm[] = [];
  for (const c of raw) {
    const term = normalizeTerm(ctx.field, c.term ?? "");
    if (!term) continue;
    const key = termKey(term);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const base = { term, meaning: clip(c.meaning, 60), reason: clip(c.reason, 120), hits: null };
    if (GENERIC_KEYS.has(key)) out.push({ ...base, status: "blocked", note: "泛词，会搜出大量无关结果" });
    else if (existing.has(key)) out.push({ ...base, status: "blocked", note: "已在输入框里" });
    else if (owner.has(key)) out.push({ ...base, status: "blocked", note: `与「${owner.get(key)}」分类重复` });
    else out.push({ ...base, status: "ok", note: "" });
  }
  return out;
}

/** 第二轮：按命中数判定。null 表示没校验（限流或失败），保持推荐但注明未校验。 */
export function applyHits(t: ClassifiedTerm, hits: number | null, field: TermField, capped = false): ClassifiedTerm {
  if (t.status === "blocked") return t;
  if (hits === null) return { ...t, hits: null, note: "未校验命中数" };
  if (hits === 0) return { ...t, hits, status: "blocked", note: "没有搜索结果" };
  if (field !== "hfSearch" && hits > BROAD_HITS) return { ...t, hits, status: "broad", note: "结果过多，可能混入大量无关项目" };
  return { ...t, hits, hitsCapped: capped, status: "ok", note: "" };
}

/** 展示顺序：推荐 → 过泛 → 不可用，同组保持模型给的顺序；截到上限。 */
export function finalizeTerms(list: readonly ClassifiedTerm[], cap: number): ClassifiedTerm[] {
  const rank: Record<TermStatus, number> = { ok: 0, broad: 1, blocked: 2 };
  return list
    .map((t, i) => ({ t, i }))
    .sort((a, b) => rank[a.t.status] - rank[b.t.status] || a.i - b.i)
    .slice(0, cap)
    .map((x) => x.t);
}

/** 解析模型输出：{"terms":[{term,meaning,reason}]}，也容忍直接给数组或字符串数组。 */
export function parseTermOutput(json: unknown): TermCandidate[] {
  const list = Array.isArray(json) ? json : json && typeof json === "object" ? (json as { terms?: unknown }).terms : null;
  if (!Array.isArray(list)) return [];
  return list
    .map((x): TermCandidate | null => {
      if (typeof x === "string") return { term: x, meaning: "", reason: "" };
      if (!x || typeof x !== "object") return null;
      const o = x as Record<string, unknown>;
      return typeof o.term === "string" ? { term: o.term, meaning: str(o.meaning), reason: str(o.reason) } : null;
    })
    .filter((x): x is TermCandidate => x !== null)
    .slice(0, 30);
}

/** 输入框文本 → 词列表（与表单解析一致：主题 / HF 按逗号或空白，关键词按逗号或换行）。 */
export function splitFieldValue(field: TermField, value: string): string[] {
  const re = field === "githubKeywords" ? /[,，、\n]+/ : /[,，、\s]+/;
  return value.split(re).map((s) => s.trim()).filter(Boolean);
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const clip = (v: string, n: number) => (v.length > n ? `${v.slice(0, n - 1)}…` : v);
