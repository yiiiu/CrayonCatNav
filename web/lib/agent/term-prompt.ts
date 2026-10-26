import { FIELD_LIMITS, FIELD_RULE_TEXT, TERM_RULES_VERSION, termFieldLabels, type TermField } from "./term-rules";

/** 扩词与分类说明的提示词（规格 §4.2）。模型输出只当数据，经 term-rules 过滤后才返回给界面。 */

export type TermContext = {
  category: { slug: string; name: string; description: string };
  /** 本分类已上架资源样例（≤15） */
  samples: readonly { name: string; summary: string; tags: readonly string[] }[];
  /** 本分类各字段当前的词（含输入框里未保存的） */
  current: Record<TermField, readonly string[]>;
  /** 其他分类：名称、说明与同字段已有的词 */
  others: readonly { name: string; description: string; terms: Record<TermField, readonly string[]> }[];
};

export const TERM_SYSTEM_PROMPT = `你是「蜡笔猫导航」（AI 开发资源导航站）的采集编辑，负责给每个分类挑选采集关键词。
关键词会直接拿去 GitHub / Hugging Face 搜索，目标是搜出真正属于该分类、质量高的资源，同时尽量不和其他分类撞车。
规则：
1. 只给生态里真实常用的写法，不要编造；宁可少给，也不要给搜不到结果的词。
2. 避免单独使用过泛的词（如 ai、llm、tool、app、awesome、python）。
3. 不要给已经存在的词，也不要给其他分类已在用的词。
4. meaning 用中文说明这个词在该生态里指什么（≤40 字）；reason 用中文说明为什么适合本分类、和相近分类怎么区分（≤60 字）。
5. 按推荐程度从高到低排序。
只输出一个 JSON 对象，不要输出任何其他文字。规则版本 ${TERM_RULES_VERSION}。`;

function contextLines(ctx: TermContext): string[] {
  return [
    "【目标分类】",
    `${ctx.category.slug}: ${ctx.category.name}`,
    `分类说明：${ctx.category.description || "（无）"}`,
    "",
    "【本分类已上架资源样例】",
    ...(ctx.samples.length ? ctx.samples.map((s) => `- ${s.name}：${s.summary}${s.tags.length ? `（${s.tags.join("、")}）` : ""}`) : ["（暂无）"]),
    "",
    "【本分类已有的词】",
    ...(Object.keys(termFieldLabels) as TermField[]).map((f) => `${termFieldLabels[f]}：${ctx.current[f].join(", ") || "（无）"}`),
  ];
}

function othersLines(ctx: TermContext, field?: TermField): string[] {
  if (!ctx.others.length) return [];
  return [
    "",
    field ? `【其他分类及其${termFieldLabels[field]}（不要重复）】` : "【其他分类（说明要能和它们区分开）】",
    ...ctx.others.map((o) => (field ? `- ${o.name}：${o.terms[field].join(", ") || "（无）"}` : `- ${o.name}：${o.description || "（无说明）"}`)),
  ];
}

export function buildTermPrompt(ctx: TermContext, field: TermField, want: number): string {
  return [
    ...contextLines(ctx),
    ...othersLines(ctx, field),
    "",
    `【任务】为「${ctx.category.name}」推荐 ${want} 个新的${termFieldLabels[field]}（该字段最多保存 ${FIELD_LIMITS[field]} 个）。`,
    `格式要求：${FIELD_RULE_TEXT[field]}`,
    "",
    "【输出 JSON】",
    `{"terms": [{"term": "...", "meaning": "中文语义", "reason": "中文推荐理由"}]}`,
  ].join("\n");
}

export const DESCRIPTION_MAX = 500;

export const DESCRIPTION_SYSTEM_PROMPT = `你是「蜡笔猫导航」（AI 开发资源导航站）的采集编辑，负责为分类写判定标准，供采集模型判断一条资源是否属于该分类。
只根据给出的分类信息与资源样例写，不编造；用简洁的中文，不写营销语。只输出一个 JSON 对象，不要输出任何其他文字。`;

export function buildDescriptionPrompt(ctx: TermContext): string {
  return [
    ...contextLines(ctx),
    ...othersLines(ctx),
    "",
    `【任务】为「${ctx.category.name}」写一段给采集模型看的分类说明（中文，120–300 字，最多 ${DESCRIPTION_MAX} 字）：`,
    "先说什么样的资源属于这个分类（列出 3–6 类典型资源），再说哪些相近的东西不属于、应归到哪个其他分类。只写判定标准，不写宣传语。",
    "",
    "【输出 JSON】",
    `{"description": "..."}`,
  ].join("\n");
}

export function parseDescriptionOutput(json: unknown): string {
  const d = json && typeof json === "object" ? (json as { description?: unknown }).description : null;
  return typeof d === "string" ? d.trim().slice(0, DESCRIPTION_MAX) : "";
}
