const defaultSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "https://crayon-cat-nav.vercel.app");

export const siteConfig = {
  name: "蜡笔猫导航",
  description: "面向 AI 开发者与创作者的资源导航和在线工具箱：发现 MCP、Agent Skills、模型 API，并直接生成配置。",
  url: defaultSiteUrl,
} as const;
