/** 面包屑的纯函数：生成 schema.org BreadcrumbList（便于单测）。 */

export type Crumb = { label: string; href?: string };

/**
 * 生成 BreadcrumbList JSON-LD。最后一项是当前页，按规范可省略 item；
 * 中间项没有 href 时也只给 name。相对链接用站点地址补全为绝对 URL。
 */
export function breadcrumbJsonLd(items: readonly Crumb[], origin: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.label,
      ...(c.href && i < items.length - 1 ? { item: new URL(c.href, origin).toString() } : {}),
    })),
  };
}

/** 把 JSON 安全地放进 <script>：转义 < 防止提前闭合标签。 */
export function safeJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
