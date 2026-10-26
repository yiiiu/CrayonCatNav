/**
 * AI 补全资源详情的纯函数部分（不依赖 Next，可单测）。
 * 计划见 docs/plan/AI批量补全-实现计划.md。
 */
import type { ResourceDetails } from "@/lib/validation/resource-details";

const decode = (s: string) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");

/** 网页 HTML → 供模型阅读的纯文本：标题、meta 描述、正文。 */
export function htmlToText(html: string, max = 6000): string {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const metaDesc =
    /<meta\b[^>]*(?:name|property)\s*=\s*["'](?:description|og:description)["'][^>]*>/i
      .exec(html)?.[0]
      .match(/\bcontent\s*=\s*["']([^"']*)["']/i)?.[1] ?? "";
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<head\b[\s\S]*?<\/head>/i, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/tr)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const text = decode(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1)
    .join("\n");
  const head = [title && `标题：${decode(title)}`, metaDesc && `描述：${decode(metaDesc)}`].filter(Boolean).join("\n");
  return `${head}${head ? "\n" : ""}${text}`.slice(0, max);
}

export type EnrichMaterial = { site: string | null; readme: string | null };
export type EnrichSubject = { name: string; summary: string; description: string; websiteUrl: string | null; githubUrl: string | null };

export const ENRICH_SYSTEM_PROMPT = `你是「蜡笔猫导航」的资源编辑，为已收录的 AI 资源补充结构化详情，帮助用户不跳转官网就能判断「能做什么、适不适合我、怎么开始」。
规则：
1. 只依据给出的资料（站内已有介绍、官网首页文本、GitHub README）写作，不编造功能、价格、平台；资料没提到就留空。
2. highlights：3–5 条核心功能；useCases：2–3 条「适合谁 / 典型场景」。每条一句中文原创表述（≤40 字），不照抄原文，不写营销夸张语。
3. quickstart：仅当资料里有明确的安装命令或配置片段时填写，原样保留命令（可多行，最多 3 条命令），否则空字符串。
4. platforms：只从 web / macos / windows / linux / ios / android / cli / api / vscode / browser-ext 中选资料能确认的。
5. pricingNote：只写资料明确的价格信息（如「免费 50 次/月，Pro $20/月」），开源免费可写「开源免费」，否则空字符串。
只输出一个 JSON 对象：{"highlights": [], "useCases": [], "quickstart": "", "platforms": [], "pricingNote": ""}，不要输出其他文字。`;

export function buildEnrichPrompt(r: EnrichSubject, m: EnrichMaterial): string {
  return [
    "【站内已有信息】",
    `名称：${r.name}`,
    `简介：${r.summary}`,
    `介绍：${r.description.slice(0, 2000) || "（无）"}`,
    `官网：${r.websiteUrl ?? "（无）"}`,
    `GitHub：${r.githubUrl ?? "（无）"}`,
    "",
    "【官网首页文本】",
    m.site || "（未能获取）",
    "",
    "【GitHub README】",
    m.readme || "（未能获取）",
  ].join("\n");
}

export type DetailField = keyof ResourceDetails | "previewImageUrl";

/** 只填空字段：已有内容一律不覆盖。返回合并结果与实际填入的字段。 */
export function mergeDetails(
  current: ResourceDetails,
  generated: ResourceDetails,
  currentPreview: string | null,
  newPreview: string | null,
): { details: ResourceDetails; previewImageUrl: string | null; filled: DetailField[] } {
  const filled: DetailField[] = [];
  const pick = <K extends keyof ResourceDetails>(k: K): ResourceDetails[K] => {
    const cur = current[k];
    const gen = generated[k];
    const empty = (v: unknown) => (Array.isArray(v) ? v.length === 0 : !v);
    if (empty(cur) && !empty(gen)) {
      filled.push(k);
      return gen;
    }
    return cur;
  };
  const details: ResourceDetails = {
    highlights: pick("highlights"),
    useCases: pick("useCases"),
    quickstart: pick("quickstart"),
    platforms: pick("platforms"),
    pricingNote: pick("pricingNote"),
  };
  let previewImageUrl = currentPreview;
  if (!currentPreview && newPreview) {
    previewImageUrl = newPreview;
    filled.push("previewImageUrl");
  }
  return { details, previewImageUrl, filled };
}

/** GitHub 仓库链接 → README 原文候选地址。 */
export function readmeUrls(githubUrl: string | null): string[] {
  const m = githubUrl?.match(/^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/);
  if (!m) return [];
  const repo = `${m[1]}/${m[2].replace(/\.git$/, "")}`;
  return ["README.md", "readme.md"].map((f) => `https://raw.githubusercontent.com/${repo}/HEAD/${f}`);
}
