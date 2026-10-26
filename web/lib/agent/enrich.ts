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

export type EnrichMaterial = { site: string | null; readme: string | null; pricing?: string | null };
export type EnrichSubject = { name: string; summary: string; description: string; websiteUrl: string | null; githubUrl: string | null };

export const ENRICH_SYSTEM_PROMPT = `你是「蜡笔猫导航」的资源编辑，为已收录的 AI 资源补充结构化详情，帮助用户不跳转官网就能判断「能做什么、适不适合我、怎么开始」。
规则：
1. 只依据给出的资料（站内已有介绍、官网首页文本、GitHub README）写作，不编造功能、价格、平台；资料没提到就留空。
2. highlights：3–5 条核心功能；useCases：2–3 条「适合谁 / 典型场景」。每条一句中文原创表述（≤40 字），不照抄原文，不写营销夸张语。
3. quickstart：仅当资料里有明确的安装命令或配置片段时填写，原样保留命令（可多行，最多 3 条命令），否则空字符串。
4. platforms：只从 web / macos / windows / linux / ios / android / cli / api / vscode / browser-ext 中选资料能确认的。
5. pricingNote：只写资料（优先看「定价页摘录」）明确的价格信息，概括主要套餐，如「Hobby 免费；Pro $20/月；Ultra $200/月」（≤80 字），开源免费可写「开源免费」，否则空字符串。
6. pricingType：根据资料判断 free / freemium / paid，资料不足填 unknown。
只输出一个 JSON 对象：{"highlights": [], "useCases": [], "quickstart": "", "platforms": [], "pricingNote": "", "pricingType": "unknown"}，不要输出其他文字。`;

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
    "【定价页摘录】",
    m.pricing || "（未能获取）",
    "",
    "【GitHub README】",
    m.readme || "（未能获取）",
  ].join("\n");
}

export type DetailField = keyof ResourceDetails | "previewImageUrl" | "pricingType";

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

/* ---------- 定价页 ---------- */

const PRICING_HINT = /pric|plans?\b|billing|subscri|定价|价格|套餐|订阅|付费/i;

/** 从首页 HTML 找同站的定价页链接；找不到时退回常见路径。最多返回 3 个候选。 */
export function findPricingUrls(html: string, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const found: string[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+)["'][^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const [, href, inner] = m;
    const text = inner.replace(/<[^>]+>/g, " ");
    if (!PRICING_HINT.test(href) && !PRICING_HINT.test(text)) continue;
    try {
      const u = new URL(href, base);
      // 只跟同站（含子域，如 www.）的 https 链接，避免跳去第三方
      const sameSite = u.hostname === base.hostname || u.hostname.endsWith(`.${base.hostname.replace(/^www\./, "")}`) || base.hostname.endsWith(`.${u.hostname}`);
      if (u.protocol !== "https:" || !sameSite || /contact|sales|login|signup|sign-in/i.test(u.pathname)) continue;
      u.search = "";
      if (!found.includes(u.toString())) found.push(u.toString());
    } catch {
      /* 非法链接跳过 */
    }
  }
  // 路径短的更可能是总定价页（/pricing 优于 /en-US/pricing/enterprise）
  found.sort((a, b) => new URL(a).pathname.length - new URL(b).pathname.length);
  if (found.length === 0) found.push(new URL("/pricing", base).toString());
  return found.slice(0, 3);
}

const PRICE_LINE = /[$¥€£]\s?\d|\d\s?(?:元|美元|USD|\/\s?(?:mo|month|yr|year|月|年|user|seat))|免费|free\b|per (?:month|user|seat)|每月|按量|credits?|tokens?|trial|试用|enterprise|企业版|\bpro\b|team/i;

/** 定价页纯文本 → 只保留含价格信息的行及其上一行（套餐名），控制篇幅。 */
export function pricingExcerpt(text: string, max = 3000): string {
  const lines = text.split("\n");
  const keep = new Set<number>();
  lines.forEach((l, i) => {
    if (PRICE_LINE.test(l) && l.length <= 300) {
      if (i > 0 && lines[i - 1].length <= 80) keep.add(i - 1);
      keep.add(i);
    }
  });
  return [...keep]
    .sort((a, b) => a - b)
    .map((i) => lines[i])
    .join("\n")
    .slice(0, max);
}
