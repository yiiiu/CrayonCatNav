import type { ComponentType } from "react";

export type ToolCategory = "ai-config" | "data" | "cost";
export type ToolPrivacy = "local";
export type ToolDefaultStatus = "enabled" | "hidden" | "beta";

/** 工具元数据：纯数据，可在服务端、种子脚本与测试中安全引用。 */
export type ToolMeta = {
  /** 与 Tool 表 slug、路由 /tools/{slug} 一致 */
  slug: string;
  name: string;
  description: string;
  category: ToolCategory;
  icon: string;
  /** 首版全部本地运算；未来出现网络能力需单独安全评审 */
  privacy: ToolPrivacy;
  defaultStatus: ToolDefaultStatus;
  sortOrder: number;
  /** 允许从资源详情预填的非敏感查询参数白名单；密钥/env 永不预填 */
  prefillParams: readonly string[];
};

export type ToolDefinition = ToolMeta & {
  /** 懒加载工具 UI */
  load: () => Promise<{ default: ComponentType }>;
};
