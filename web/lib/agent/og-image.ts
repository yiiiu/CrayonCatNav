/**
 * 从网页 HTML 里取预览图：og:image → og:image:secure_url → twitter:image。
 * 相对地址按页面地址补全；只接受 https，避免混合内容。纯函数，便于单测。
 */
export function extractOgImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 200_000);
  const metas = head.match(/<meta\b[^>]*>/gi) ?? [];
  const found = new Map<string, string>();
  for (const tag of metas) {
    const key = /\b(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase();
    const content = /\bcontent\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (key && content && !found.has(key)) found.set(key, content.trim().replace(/&amp;/g, "&"));
  }
  for (const key of ["og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src"]) {
    const v = found.get(key);
    if (!v) continue;
    try {
      const u = new URL(v, pageUrl);
      if (u.protocol === "https:" && u.toString().length <= 1000) return u.toString();
    } catch {
      /* 非法地址跳过 */
    }
  }
  return null;
}
