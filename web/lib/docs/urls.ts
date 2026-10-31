import { siteConfig } from "@/lib/site";

/** 文档里展示的接入地址（服务端渲染时按部署环境生成）。 */
export const siteOrigin = () => siteConfig.url.replace(/\/$/, "");
export const mcpUrl = () => `${siteOrigin()}/api/mcp`;
export const apiBase = () => `${siteOrigin()}/api/agent/v1`;
