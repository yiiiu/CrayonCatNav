/**
 * 标签受控词表（纯函数，可单测）：名称 / 别名解析、模型建议词清洗、审核输入「名字:slug」解析。
 * 见 docs/plan/标签治理方案.md 第一阶段。
 */
import { isTagSlug } from "@/prisma/tag-slugs";

export type VocabTag = { name: string; slug: string; aliases?: readonly string[] };
export type VocabSuggestion = { name: string; slug: string; status: "open" | "accepted" | "merged" | "ignored" };

export type TagVocab = {
  /** 名称或别名（忽略大小写）→ 现有标签的规范名称 */
  byName: ReadonlyMap<string, string>;
  /** slug → 现有标签名称 */
  bySlug: ReadonlyMap<string, string>;
  /** 已忽略的建议词（小写名称与 slug） */
  ignored: ReadonlySet<string>;
};

export type SuggestedTag = { name: string; slug: string };

export const MAX_TAGS = 6;
export const MAX_SUGGESTED = 2;

const key = (s: string) => s.trim().toLowerCase();

/** 规范化一个标签名：去 #、合并空白、两端去空格；空或超过 20 字返回 null。 */
export function cleanTagName(raw: unknown): string | null {
  const t = String(raw ?? "").replace(/^#+/, "").replace(/\s+/g, " ").trim();
  return t && t.length <= 20 ? t : null;
}

export function buildVocab(tags: readonly VocabTag[], suggestions: readonly VocabSuggestion[] = []): TagVocab {
  const byName = new Map<string, string>();
  const bySlug = new Map<string, string>();
  for (const t of tags) {
    byName.set(key(t.name), t.name);
    bySlug.set(t.slug, t.name);
  }
  // 别名后写，不覆盖真实名称
  for (const t of tags) for (const a of t.aliases ?? []) if (!byName.has(key(a))) byName.set(key(a), t.name);
  const ignored = new Set<string>();
  for (const s of suggestions) {
    if (s.status !== "ignored") continue;
    ignored.add(key(s.name));
    ignored.add(s.slug);
  }
  return { byName, bySlug, ignored };
}

/** 名称或别名 → 现有标签规范名称；不认识返回 null。 */
export function resolveTag(name: string, vocab: TagVocab): string | null {
  return vocab.byName.get(key(name)) ?? null;
}

/**
 * 清洗模型的 tags 与 suggestedTags：
 * - tags 只保留能映射到现有标签（名称 / 别名）的，不认识的丢弃；
 * - suggestedTags 命中现有标签的并入 tags；命中已忽略的、slug 非法的、slug 被其他名称的标签占用的一律丢弃（不合并）。
 */
export function cleanTagOutput(
  rawTags: readonly unknown[],
  rawSuggested: readonly unknown[],
  vocab: TagVocab,
): { tags: string[]; suggestedTags: SuggestedTag[] } {
  const tags: string[] = [];
  const seen = new Set<string>();
  const push = (name: string) => {
    if (tags.length >= MAX_TAGS || seen.has(key(name))) return;
    seen.add(key(name));
    tags.push(name);
  };
  for (const r of rawTags) {
    const n = cleanTagName(r);
    const hit = n ? resolveTag(n, vocab) : null;
    if (hit) push(hit);
  }
  const suggestedTags: SuggestedTag[] = [];
  for (const r of rawSuggested) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const name = cleanTagName(o.name);
    if (!name) continue;
    const hit = resolveTag(name, vocab);
    if (hit) {
      push(hit);
      continue;
    }
    const slug = String(o.slug ?? "").trim().toLowerCase();
    if (!isTagSlug(slug)) continue;
    if (vocab.ignored.has(key(name)) || vocab.ignored.has(slug)) continue;
    if (vocab.bySlug.has(slug)) continue; // slug 被别的名称占用：不合并、不建议
    if (suggestedTags.length >= MAX_SUGGESTED || suggestedTags.some((s) => s.slug === slug || key(s.name) === key(name))) continue;
    suggestedTags.push({ name, slug });
  }
  return { tags, suggestedTags };
}

/** 审核输入里的一项：`名字` 或 `名字:slug`（中英文冒号都可）。 */
export type TagEntry = { name: string; slug?: string };

export function parseTagEntry(raw: string): TagEntry | null {
  const m = raw.match(/^(.*?)[:：]\s*([A-Za-z0-9-]+)\s*$/);
  const name = cleanTagName(m ? m[1] : raw);
  if (!name) return null;
  return m ? { name, slug: m[2].toLowerCase() } : { name };
}

/** 逗号（中英文）、顿号或换行分隔的标签输入 → 去重后的条目。 */
export function parseTagInput(input: string): TagEntry[] {
  const out: TagEntry[] = [];
  for (const part of input.split(/[,，、\n]/)) {
    const e = parseTagEntry(part.trim());
    if (e && !out.some((x) => key(x.name) === key(e.name))) out.push(e);
  }
  return out;
}

/** 候选的标签 → 审核输入框的默认值：现有标签写名字，建议的新标签写成「名字:slug」。 */
export function formatTagInput(tags: readonly string[], suggested: readonly SuggestedTag[]): string {
  return [...tags, ...suggested.map((s) => `${s.name}:${s.slug}`)].join("，");
}
