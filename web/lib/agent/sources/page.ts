import type { RawCandidate } from "../types";
import { canonicalGithubUrl } from "../url";

/** 管理员贴的普通网页：从 HTML 里取标题、描述与正文片段（纯函数，不执行脚本）。 */

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };

export function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1].toLowerCase() === "x" ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function metaContent(html: string, key: string): string {
  // 兼容 name= / property= 与属性顺序互换
  const re = new RegExp(`<meta\\s[^>]*(?:name|property)\\s*=\\s*["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return "";
  const c = tag.match(/content\s*=\s*"([^"]*)"/i) ?? tag.match(/content\s*=\s*'([^']*)'/i);
  return c ? decodeEntities(c[1]).trim() : "";
}

export function extractPageInfo(html: string) {
  const title = decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim();
  const ogTitle = metaContent(html, "og:title");
  const siteName = metaContent(html, "og:site_name");
  const description = metaContent(html, "description") || metaContent(html, "og:description") || metaContent(html, "twitter:description");
  const text = decodeEntities(
    html
      .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<(br|p|div|li|h[1-6]|section|article)[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, 1500);
  return { title: (ogTitle || title).slice(0, 120), siteName: siteName.slice(0, 60), description: description.slice(0, 600), text };
}

/** 网页 → 原始候选。finalUrl 是跟随重定向后的地址。 */
export function pageToRaw(html: string, finalUrl: string): RawCandidate {
  const info = extractPageInfo(html);
  const github = canonicalGithubUrl(finalUrl);
  const host = new URL(finalUrl).hostname.replace(/^www\./, "");
  return {
    source: "manual",
    sourceUrl: finalUrl,
    title: info.siteName || info.title || host,
    websiteUrl: github ? null : finalUrl.startsWith("https://") ? finalUrl : null,
    githubUrl: github,
    description: info.description,
    stars: null,
    sourceUpdatedAt: null,
    hints: [...(info.title ? [`页面标题：${info.title}`] : []), ...(info.text ? [`页面正文片段：${info.text}`] : [])],
  };
}
