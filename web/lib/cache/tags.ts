/** 缓存标签：后台写操作后用 updateTag(tag) 失效对应缓存（Cache Components）。 */
export const cacheTags = {
  resources: "resources",
  resource: (slug: string) => `resource:${slug}`,
  home: "home",
  taxonomy: "taxonomy",
  tools: "tools",
} as const;
