/**
 * 推荐气泡的本地持久化（规格 docs/spec/前台推荐Agent方案.md §2.1）。
 * 只存在访客自己浏览器的 localStorage：本站服务器不保存对话。
 * - 对话：最近 MAX_TURNS 轮已完成的问答，最后一次写入 30 天后过期。
 * - 输入历史：最近 INPUT_HISTORY_MAX 条发出的问题，供输入框 ↑/↓ 翻看。
 * 纯函数 + 薄的读写包装，读写失败（隐私模式、配额满、JSON 损坏）一律静默当作空。
 */

export type RecItem = {
  slug: string;
  name: string;
  summary: string;
  category: { slug: string; name: string };
  tools: string[];
  reason: string;
};
export type RecReply =
  | { ok: true; mode: "ai" | "fallback"; items: RecItem[]; note?: string; notice?: string }
  | { ok: false; code: string; message: string };
export type RecTurn = { id: number; q: string; reply: RecReply | null };

export const STORE_KEY = "ccn:recommend:v1";
export const INPUT_KEY = "ccn:recommend:inputs:v1";
export const MAX_TURNS = 20;
export const INPUT_HISTORY_MAX = 20;
export const TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CONTEXT_TURNS = 2;

type Stored = { v: 1; savedAt: number; turns: { q: string; reply: RecReply | null }[] };

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function cleanItem(v: unknown): RecItem | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const cat = (o.category ?? {}) as Record<string, unknown>;
  const slug = str(o.slug, 80);
  const name = str(o.name, 120);
  if (!slug || !name) return null;
  return {
    slug,
    name,
    summary: str(o.summary, 300),
    category: { slug: str(cat.slug, 80), name: str(cat.name, 60) },
    tools: Array.isArray(o.tools) ? o.tools.filter((t): t is string => typeof t === "string").slice(0, 5) : [],
    reason: str(o.reason, 120),
  };
}

/** 只保留界面需要的字段，丢掉服务端多带的（网址、标签等），也防止存储被篡改后渲染出意外内容。 */
export function cleanReply(v: unknown): RecReply | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (o.ok === true) {
    const items = Array.isArray(o.items) ? o.items.map(cleanItem).filter((x): x is RecItem => !!x).slice(0, 10) : [];
    const r: RecReply = { ok: true, mode: o.mode === "ai" ? "ai" : "fallback", items };
    if (str(o.note, 120)) r.note = str(o.note, 120);
    if (str(o.notice, 120)) r.notice = str(o.notice, 120);
    return r;
  }
  if (o.ok === false) return { ok: false, code: str(o.code, 40) || "error", message: str(o.message, 120) || "出错了" };
  return null;
}

/** 解析存储内容：过期、版本不对、格式错误都返回空；未完成（reply 为空）的轮次丢弃。 */
export function parseStored(raw: string | null, now: number): RecTurn[] {
  if (!raw) return [];
  try {
    const s = JSON.parse(raw) as Partial<Stored>;
    if (s?.v !== 1 || typeof s.savedAt !== "number" || now - s.savedAt > TTL_MS || !Array.isArray(s.turns)) return [];
    const out: RecTurn[] = [];
    for (const t of s.turns) {
      const q = str((t as RecTurn)?.q, 200);
      const reply = cleanReply((t as RecTurn)?.reply);
      if (q && reply) out.push({ id: out.length + 1, q, reply });
    }
    return out.slice(-MAX_TURNS);
  } catch {
    return [];
  }
}

export function serializeTurns(turns: RecTurn[], now: number): string {
  const done = turns.filter((t) => t.reply).slice(-MAX_TURNS);
  return JSON.stringify({ v: 1, savedAt: now, turns: done.map((t) => ({ q: t.q, reply: t.reply })) } satisfies Stored);
}

/** 追问上文：最近 CONTEXT_TURNS 轮成功的问答（问题 + 推荐的 slug）。 */
export function contextOf(turns: RecTurn[]): { q: string; slugs: string[] }[] {
  return turns
    .filter((t) => t.reply?.ok)
    .slice(-CONTEXT_TURNS)
    .map((t) => ({ q: t.q, slugs: t.reply && t.reply.ok ? t.reply.items.map((i) => i.slug).slice(0, 5) : [] }));
}

export function parseInputs(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string" && x.length > 0).map((x) => x.slice(0, 200)).slice(-INPUT_HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

/** 记录一条发出的问题：去掉与之相同的旧记录，放到末尾，最多 INPUT_HISTORY_MAX 条。 */
export function pushInput(list: string[], q: string): string[] {
  return [...list.filter((x) => x !== q), q].slice(-INPUT_HISTORY_MAX);
}

/**
 * 输入框 ↑/↓ 翻历史（像终端）：
 * index = list.length 表示「当前草稿」；↑ 往旧翻，↓ 往新翻，翻回末尾时恢复草稿。
 * 返回 null 表示不处理（已到头 / 没有历史）。
 */
export function stepHistory(list: string[], index: number, dir: -1 | 1, draft: string): { index: number; value: string } | null {
  if (list.length === 0) return null;
  const next = Math.min(list.length, Math.max(0, index + dir));
  if (next === index) return null;
  return { index: next, value: next === list.length ? draft : list[next] };
}

export function load<T>(key: string, parse: (raw: string | null) => T, fallback: T): T {
  try {
    return parse(window.localStorage.getItem(key));
  } catch {
    return fallback;
  }
}

export function save(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* 隐私模式 / 配额满：不持久化，界面照常 */
  }
}
