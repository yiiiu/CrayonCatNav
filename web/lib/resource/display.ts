/**
 * 资源卡片的展示整理（纯函数，可单测）：标题拆分、标签去重。
 */

/** 末尾括号说明，如「DeepSeek-Reasonix（面向复杂工程任务的开源编码 Agent）」。 */
const TRAILING_NOTE = /^(.+?)\s*[（(]([^（）()]+)[）)]\s*$/;
/** 「Beautiful UI — AI 原生界面组件库」这种破折号说明。 */
const DASH_NOTE = /^(.+?)\s+[—–-]{1,2}\s+(.+)$/;

/** 把「原名（中文说明）」拆成标题和说明；拆不出来时说明为空。 */
export function splitName(name: string): { title: string; note: string } {
  const s = name.trim();
  const m = TRAILING_NOTE.exec(s) ?? DASH_NOTE.exec(s);
  // 只拆中文说明，避免把「Qwen3 (235B)」「XX - Python SDK」这类名字本身的一部分拆掉
  if (m && m[1].trim().length >= 2 && /[\u4e00-\u9fff]/.test(m[2])) return { title: m[1].trim(), note: m[2].trim() };
  return { title: s, note: "" };
}

/** 比较标签是否重复：忽略大小写、空格、连字符。 */
export const normTag = (s: string) => s.toLowerCase().replace(/[\s\-_·]/g, "");

/**
 * 卡片上展示的标签：去掉与分类同名的、彼此重复的（「AI 编程」与「AI编程」），最多 max 个。
 */
export function cardTags<T extends { id: string; name: string }>(tags: readonly T[], categoryName: string, max = 3): T[] {
  const seen = new Set([normTag(categoryName)]);
  const out: T[] = [];
  for (const t of tags) {
    const k = normTag(t.name);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * 资源 Logo 候选地址，按顺序尝试：后台填的图标 → GitHub 组织/作者头像 → 官网 favicon。
 * 只用 https；全部失败时由组件回退到首字母色块。
 */
export function logoCandidates(r: { iconUrl?: string | null; githubUrl?: string | null; websiteUrl?: string | null }): string[] {
  const out: string[] = [];
  const add = (u: string) => {
    if (!out.includes(u)) out.push(u);
  };
  if (r.iconUrl?.startsWith("https://")) add(r.iconUrl);
  const owner = r.githubUrl?.match(/^https:\/\/github\.com\/([A-Za-z0-9-]+)/)?.[1];
  if (owner) add(`https://avatars.githubusercontent.com/${owner}?s=96`);
  if (r.websiteUrl?.startsWith("https://")) {
    try {
      const u = new URL(r.websiteUrl);
      if (u.hostname !== "github.com") add(`${u.origin}/favicon.ico`);
    } catch {
      /* 非法链接跳过 */
    }
  }
  return out;
}

/** 侧栏标签：最多显示 limit 个，当前选中的标签总在可见区。 */
export function splitTags<T extends { slug: string }>(tags: readonly T[], active: string | undefined, limit = 12): { shown: T[]; more: T[] } {
  const shown = tags.slice(0, limit);
  const more = tags.slice(limit);
  const i = more.findIndex((t) => t.slug === active);
  if (i >= 0) shown.push(...more.splice(i, 1));
  return { shown, more };
}
