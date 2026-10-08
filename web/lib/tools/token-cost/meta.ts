import type { ToolMeta } from "../types";

export const tokenCostMeta = {
  slug: "token-cost",
  name: "模型 Token 成本估算",
  description: "按输入/输出 Token 与每百万单价估算单次及合计费用，公式透明。",
  category: "cost",
  icon: "coins",
  privacy: "local",
  defaultStatus: "enabled",
  sortOrder: 30,
  prefillParams: ["inPrice", "outPrice", "currency"],
} as const satisfies ToolMeta;
