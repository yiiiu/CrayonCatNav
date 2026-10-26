import { z } from "zod";

/**
 * 资源详情的结构化补充（Resource.details JSON 列）。
 * 全部可空：字段为空时详情页不展示对应区块，老数据无需迁移内容。
 * 方案见 docs/spec/资源详情页优化方案.md。
 */

export const platforms = ["web", "macos", "windows", "linux", "ios", "android", "cli", "api", "vscode", "browser-ext"] as const;
export type Platform = (typeof platforms)[number];

export const platformLabels: Record<Platform, string> = {
  web: "Web",
  macos: "macOS",
  windows: "Windows",
  linux: "Linux",
  ios: "iOS",
  android: "Android",
  cli: "命令行",
  api: "API",
  vscode: "VS Code",
  "browser-ext": "浏览器插件",
};

const line = (max: number) => z.string().trim().min(1).max(max);

export const LIMITS = { highlights: 6, useCases: 4, item: 120, quickstart: 2000, pricingNote: 200 } as const;

export const resourceDetailsSchema = z.object({
  /** 核心功能，每条一句话 */
  highlights: z.array(line(LIMITS.item)).max(LIMITS.highlights, `核心功能最多 ${LIMITS.highlights} 条`).default([]),
  /** 适合谁 / 典型场景 */
  useCases: z.array(line(LIMITS.item)).max(LIMITS.useCases, `适用场景最多 ${LIMITS.useCases} 条`).default([]),
  /** 快速上手：安装命令或配置片段（原样展示为代码块） */
  quickstart: z.string().trim().max(LIMITS.quickstart, `快速上手最多 ${LIMITS.quickstart} 字`).default(""),
  platforms: z.array(z.enum(platforms)).default([]),
  /** 定价补充说明，如「免费 50 次/月，Pro $20/月」 */
  pricingNote: z.string().trim().max(LIMITS.pricingNote, `定价说明最多 ${LIMITS.pricingNote} 字`).default(""),
});

export type ResourceDetails = z.infer<typeof resourceDetailsSchema>;

export const emptyDetails = (): ResourceDetails => ({ highlights: [], useCases: [], quickstart: "", platforms: [], pricingNote: "" });

/** 读库：旧数据 / 脏数据一律容错成空详情，不让详情页报错。 */
export function readDetails(json: unknown): ResourceDetails {
  const r = resourceDetailsSchema.safeParse(json ?? {});
  return r.success ? r.data : emptyDetails();
}

/** 多行文本 → 列表：按行拆分，去掉行首的 - • · 数字. 等列表符号与空行。 */
export function linesToList(text: string, max: number): string[] {
  return text
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*(?:[-*•·]|\d+[.、)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, max);
}

export function hasDetails(d: ResourceDetails): boolean {
  return d.highlights.length > 0 || d.useCases.length > 0 || !!d.quickstart || d.platforms.length > 0 || !!d.pricingNote;
}

/** 宽松清洗模型输出：非法项丢弃、超长截断，不因为某个字段不合格而整条失败。 */
export function cleanModelDetails(v: {
  highlights?: unknown;
  useCases?: unknown;
  quickstart?: unknown;
  platforms?: unknown;
  pricingNote?: unknown;
}): ResourceDetails {
  const strs = (x: unknown, n: number) =>
    (Array.isArray(x) ? x : [])
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim().slice(0, LIMITS.item))
      .filter(Boolean)
      .slice(0, n);
  const str = (x: unknown, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
  return {
    highlights: strs(v.highlights, LIMITS.highlights),
    useCases: strs(v.useCases, LIMITS.useCases),
    quickstart: str(v.quickstart, LIMITS.quickstart),
    platforms: [...new Set((Array.isArray(v.platforms) ? v.platforms : []).filter((p): p is Platform => (platforms as readonly unknown[]).includes(p)))],
    pricingNote: str(v.pricingNote, LIMITS.pricingNote),
  };
}
