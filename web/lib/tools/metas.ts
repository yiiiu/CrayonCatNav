import { dataConverterMeta } from "./data-converter/meta";
import { mcpConfigMeta } from "./mcp-config/meta";
import { tokenCostMeta } from "./token-cost/meta";
import type { ToolMeta } from "./types";

/** 纯元数据列表（无 React 依赖），供种子脚本、sitemap、埋点白名单使用。 */
export const toolMetas = [mcpConfigMeta, dataConverterMeta, tokenCostMeta] as const satisfies readonly ToolMeta[];

export type ToolSlug = (typeof toolMetas)[number]["slug"];

export const toolSlugs: readonly ToolSlug[] = toolMetas.map((t) => t.slug);

export function isToolSlug(value: string): value is ToolSlug {
  return (toolSlugs as readonly string[]).includes(value);
}

/** 只保留白名单内的预填参数，其余（含任何密钥类字段）一律丢弃。 */
export function pickPrefillParams(slug: ToolSlug, params: Record<string, string | undefined>) {
  const meta = toolMetas.find((t) => t.slug === slug)!;
  const out = new URLSearchParams();
  for (const key of meta.prefillParams) {
    const v = params[key];
    if (v) out.set(key, v);
  }
  return out;
}

/** 是否在前台公开展示（运营状态 Tool.status 接入后在 domain 层再做一次交集）。 */
export function isPubliclyListed(meta: Pick<ToolMeta, "defaultStatus">): boolean {
  return meta.defaultStatus !== "hidden";
}
