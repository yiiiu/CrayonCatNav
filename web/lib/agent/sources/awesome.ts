import type { RawCandidate } from "../types";
import { canonicalGithubUrl } from "../url";
import { fetchText } from "./http";

/**
 * awesome 清单：读取 GitHub 仓库 README 的 raw markdown，解析列表项里的链接与说明。
 * 白名单写死在这里，不接受任意地址。
 */
export const AWESOME_LISTS = [
  {
    repo: "punkpeye/awesome-mcp-servers",
    raw: "https://raw.githubusercontent.com/punkpeye/awesome-mcp-servers/main/README.md",
  },
] as const;

/** 列表项：`- [名称](链接) 徽章/图标… - 说明`（也兼容 `* ` 开头与 `—`/`–` 分隔）。 */
const ITEM_RE = /^\s*[-*]\s+\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(.*)$/;
const HEADING_RE = /^#{2,4}\s+(.*)$/;
const BODY_SECTION_RE = /server implementations|servers|frameworks|tools|projects/i;
const OFFICIAL_HINT = "清单标注为官方实现";

function cleanHeading(h: string) {
  return h
    .replace(/<[^>]+>/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[^\p{L}\p{N}&/ ,.+-]/gu, "")
    .trim();
}

/** 去掉徽章图片、链接与平台图标，只留文字说明。 */
function cleanDescription(rest: string) {
  const text = rest
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, "") // [![徽章](图)](链接)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // ![图](地址)
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1"); // 普通链接留文字
  const m = text.match(/\s[-–—]\s+(.*)$/);
  return (m ? m[1] : text)
    .replace(/[`*_]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseAwesomeMarkdown(md: string, listRepo: string): RawCandidate[] {
  const out: RawCandidate[] = [];
  const seen = new Set<string>();
  let section = "";
  // 只收正文章节（二级标题含 Server Implementations / Frameworks 等）；目录、教程、社区等章节跳过
  let inBody = false;
  for (const line of md.split(/\r?\n/)) {
    const h = line.match(HEADING_RE);
    if (h) {
      section = cleanHeading(h[1]);
      if (/^##\s/.test(line)) inBody = BODY_SECTION_RE.test(section);
      continue;
    }
    if (!inBody) continue;
    const m = line.match(ITEM_RE);
    if (!m) continue;
    const [, name, url, rest] = m;
    if (url.includes("#")) continue; // 页内锚点
    const githubUrl = canonicalGithubUrl(url);
    const websiteUrl = githubUrl ? null : url.startsWith("https://") ? url : null;
    if (!githubUrl && !websiteUrl) continue;
    const key = (githubUrl ?? websiteUrl)!.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const official = rest.includes("🎖");
    out.push({
      source: "awesome",
      sourceUrl: `https://github.com/${listRepo}`,
      title: name.replace(/^@/, "").trim(),
      websiteUrl,
      githubUrl,
      description: cleanDescription(rest).slice(0, 600),
      stars: null,
      sourceUpdatedAt: null,
      hints: [`清单：${listRepo}`, ...(section ? [`分组：${section}`] : []), ...(official ? [OFFICIAL_HINT] : [])],
    });
  }
  return out;
}

/** 清单很长且没有 star：官方实现优先，其余按当天日期轮换起点，避免每天都从开头取。 */
export function orderAwesome(items: RawCandidate[], now = new Date()): RawCandidate[] {
  const official = items.filter((i) => i.hints?.includes(OFFICIAL_HINT));
  const rest = items.filter((i) => !i.hints?.includes(OFFICIAL_HINT));
  const day = Math.floor(now.getTime() / 86_400_000);
  const rotate = <T,>(a: T[]) => (a.length ? [...a.slice((day * 37) % a.length), ...a.slice(0, (day * 37) % a.length)] : a);
  return [...rotate(official), ...rotate(rest)];
}

export async function fetchAwesome(now = new Date()): Promise<RawCandidate[]> {
  const all: RawCandidate[] = [];
  for (const list of AWESOME_LISTS) {
    const md = await fetchText(list.raw, { maxBytes: 5_000_000, timeoutMs: 20_000 });
    all.push(...parseAwesomeMarkdown(md, list.repo));
  }
  return orderAwesome(all, now);
}
