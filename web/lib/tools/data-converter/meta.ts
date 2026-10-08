import type { ToolMeta } from "../types";

export const dataConverterMeta = {
  slug: "data-converter",
  name: "JSON / YAML / TOML 转换",
  description: "三种配置格式互转与语法校验，不能无损对应的值会明确提示。",
  category: "data",
  icon: "shuffle",
  privacy: "local",
  defaultStatus: "enabled",
  sortOrder: 20,
  prefillParams: ["from", "to"],
} as const satisfies ToolMeta;
