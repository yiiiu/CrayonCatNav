/**
 * OpenAI 兼容的 Chat Completions 调用与提示词（不依赖 Next，可单测；fetch 可注入）。
 * 用 response_format: json_object 要求结构化输出；密钥只放请求头，不进日志与错误信息。
 */
import type { RawCandidate } from "./types";

export type ChatConfig = { baseUrl: string; apiKey: string; model: string };
export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };
export type ChatUsage = { promptTokens: number; completionTokens: number };
export type ChatResult = { content: string; usage: ChatUsage | null };

export class LlmError extends Error {}

/** 规范 Base URL：去尾斜杠；误填了完整的 /chat/completions 也能用。 */
export function normalizeBaseUrl(input: string): string {
  return input.trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
}

export async function chat(
  cfg: ChatConfig,
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; timeoutMs?: number; fetchImpl?: typeof fetch } = {},
): Promise<ChatResult> {
  const f = opts.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await f(`${normalizeBaseUrl(cfg.baseUrl)}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.3,
        ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
      cache: "no-store",
    });
  } catch (e) {
    throw new LlmError(e instanceof Error && e.name === "TimeoutError" ? "模型接口超时" : "无法连接模型接口，请检查 Base URL");
  }
  const text = await res.text();
  if (!res.ok) {
    // 只透出服务端错误消息的前 160 字，避免把请求内容回显出来
    let msg = "";
    try {
      const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      msg = typeof j.error === "string" ? j.error : (j.error?.message ?? j.message ?? "");
    } catch {
      /* 非 JSON 错误体忽略 */
    }
    throw new LlmError(`模型接口返回 HTTP ${res.status}${msg ? `：${msg.slice(0, 160)}` : ""}`);
  }
  let j: { choices?: { message?: { content?: string | null } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  try {
    j = JSON.parse(text);
  } catch {
    throw new LlmError("模型接口返回的不是 JSON，请确认是 OpenAI 兼容格式");
  }
  const content = j.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new LlmError("模型没有返回内容");
  const usage = j.usage && typeof j.usage.prompt_tokens === "number" ? { promptTokens: j.usage.prompt_tokens, completionTokens: j.usage.completion_tokens ?? 0 } : null;
  return { content, usage };
}

/* ---------- 提示词 ---------- */

export type PromptCategory = { slug: string; name: string; /** 分类采集配置里的说明，可为空 */ description?: string };

export type PromptContext = {
  categories: readonly PromptCategory[];
  /** 本次目标分类（按分类定向采集）；贴链接整理时为空，不限分类 */
  target?: PromptCategory | null;
  tagNames: readonly string[];
  tools: readonly { slug: string; name: string; description: string }[];
};

export const SYSTEM_PROMPT = `你是「蜡笔猫导航」的资源编辑，负责把来源数据整理成中文导航条目，供人工审核。
规则：
1. 只根据给出的来源数据写作，不编造功能、价格、数据、公司背景；信息不足就写得保守一些，并降低 confidence。
2. summary 与 description 必须是你原创的中文表述，不要直接翻译或照抄原文句子；summary 一句话（≤80 字为宜，最多 200 字）说明它是什么、解决什么问题；description 2–3 段，每段 1–3 句，段落之间空一行，写清适合谁、核心能力、使用方式，不写营销夸张语。
3. categorySlug 只能从给定分类里选一个；toolSlugs 只能从给定工具里选（无关就给空数组）。如果给出了「本次目标分类」，按其中的要求判断归类。
4. tags 给 2–5 个标签，只能原样使用「现有标签」里的写法，不要自己新造。确实缺少关键标签时，可以在 suggestedTags 里建议最多 2 个新标签：name 为 2–6 个字的中文或常见英文词，slug 为对应的小写英文、数字与连字符（如 {"name": "视频剪辑", "slug": "video-editing"}）；不要建议与现有标签同义的词。
5. websiteUrl / githubUrl：只能原样使用来源给出的链接；若来源给的链接明显不是产品本身，设为 null。不要自己补链接。
6. pricingType 取 free / freemium / paid / unknown，来源没说明就填 unknown（开源免费项目可填 free）。
7. reason 用一两句中文说明为什么值得收录（或不确定之处）；confidence 为 0–1 的数字，表示这条值得上架且信息准确的把握。
8. 如果它与 AI 无关、明显是营销垃圾/空壳/重复聚合页，或信息少到无法介绍，输出 {"skip": true, "reason": "原因"}。
只输出一个 JSON 对象，不要输出任何其他文字。`;

/** 目标分类段落：本次采集是为这个分类找资源。 */
export function targetSection(t: PromptCategory): string[] {
  return [
    "【本次目标分类】",
    `${t.slug}: ${t.name}`,
    `分类说明：${t.description || "（无）"}`,
    `要求：本次是专门为「${t.name}」找资源。属于这个分类就把 categorySlug 设为 ${t.slug}；`,
    `明显不属于时，可以改选更合适的其他分类，但 confidence 不要超过 0.5，并在 reason 开头写明「不属于目标分类」及原因；`,
    "和目标分类、其他分类都不搭，就输出 skip。",
  ];
}

export function buildUserPrompt(raw: RawCandidate, ctx: PromptContext): string {
  const lines = [
    "【来源数据】",
    `来源：${raw.source}`,
    `名称：${raw.title}`,
    `原始简介：${raw.description || "（无）"}`,
    `官网：${raw.websiteUrl ?? "（无）"}`,
    `GitHub：${raw.githubUrl ?? "（无）"}`,
    ...(raw.stars !== null ? [`star/点赞：${raw.stars}`] : []),
    ...(raw.sourceUpdatedAt ? [`来源更新时间：${raw.sourceUpdatedAt.toISOString().slice(0, 10)}`] : []),
    ...(raw.hints ?? []),
    "",
    "【可选分类（categorySlug: 名称——说明）】",
    ...ctx.categories.map((c) => `${c.slug}: ${c.name}${c.description ? `——${c.description}` : ""}`),
    ...(ctx.target ? ["", ...targetSection(ctx.target)] : []),
    "",
    "【现有标签】",
    ctx.tagNames.slice(0, 200).join("、") || "（暂无）",
    "",
    "【可关联工具（toolSlugs）】",
    ...ctx.tools.map((t) => `${t.slug}: ${t.name}——${t.description}`),
    "",
    "【输出 JSON 字段】",
    `{"name": "产品名（保留原名，可加中文说明不超过 80 字）", "slug": "小写英文-连字符", "summary": "中文一句话", "description": "中文多段", "categorySlug": "...", "tags": ["现有标签"], "suggestedTags": [], "websiteUrl": "... 或 null", "githubUrl": "... 或 null", "pricingType": "unknown", "toolSlugs": [], "reason": "中文推荐理由", "confidence": 0.0}`,
  ];
  return lines.join("\n");
}
