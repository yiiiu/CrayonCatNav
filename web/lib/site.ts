/** 正式生产域名（2026-11 绑定，根域名 308 跳到 www）。 */
export const productionSiteUrl = "https://www.crayoncat.online";

const defaultSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_ENV === "production"
    ? productionSiteUrl
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : productionSiteUrl);

export const siteConfig = {
  name: "蜡笔猫导航",
  description: "面向 AI 开发者与创作者的资源导航和在线工具箱：发现 MCP、Agent Skills、模型 API，并直接生成配置。",
  url: defaultSiteUrl,
} as const;
