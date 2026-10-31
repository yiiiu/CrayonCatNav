export type DocPage = { href: string; title: string; soon?: boolean };

/** 文档中心目录（顺序即侧栏顺序）。soon：功能尚未上线，页面只做预告，不进 sitemap。 */
export const DOC_PAGES: readonly DocPage[] = [
  { href: "/docs", title: "概览" },
  { href: "/docs/mcp", title: "MCP 接入" },
  { href: "/docs/api", title: "HTTP API" },
  { href: "/docs/skill", title: "Skill 接入", soon: true },
  { href: "/docs/cli", title: "CLI 接入", soon: true },
];
