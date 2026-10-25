import "server-only";
import { activeSources, isCollectable, pickTargetCategory, type CategoryStat, type GlobalSources } from "@/lib/agent/category-target";
import * as repo from "@/lib/data/agent.repo";
import { collectConfigSchema, parseStoredConfig, type CollectSourceKey } from "@/lib/validation/collect-config";
import { DomainError } from "./result";

/**
 * 分类采集配置：读取（含各分类已上架 / 待审核计数，用来一眼看出倾斜）、保存、选目标分类。
 * 「已上架」= 已发布资源数；「待审核」= 状态为 pending、categorySlug 为该分类的候选数。
 */

export type CategoryCollectRow = CategoryStat & {
  /** 库里有配置但校验不通过（如手改数据库） */
  invalid: boolean;
  /** 本次会实际运行的来源（分类开启 ∩ 全局开启） */
  active: CollectSourceKey[];
  collectable: boolean;
};

/** 全局来源开关：Product Hunt 需要「开关开启且已存 Token」才算可用。 */
export async function loadGlobalSources(): Promise<GlobalSources> {
  const s = await repo.getSetting();
  return {
    github: s.srcGithub,
    mcpRegistry: s.srcMcpRegistry,
    awesome: s.srcAwesome,
    huggingface: s.srcHuggingface,
    productHunt: s.srcProductHunt && !!s.phTokenEnc,
  };
}

export async function listCategoryCollectRows(global?: GlobalSources): Promise<CategoryCollectRow[]> {
  const [cats, counts, g] = await Promise.all([repo.listCategoriesWithCollectConfig(), repo.categoryCounts(), global ? Promise.resolve(global) : loadGlobalSources()]);
  return cats.map((c) => {
    const config = c.rawConfig === null ? null : parseStoredConfig(c.rawConfig);
    const stat = {
      id: c.id,
      slug: c.slug,
      name: c.name,
      sortOrder: c.sortOrder,
      published: counts.publishedById.get(c.id) ?? 0,
      pending: counts.pendingBySlug.get(c.slug) ?? 0,
      config,
    };
    return { ...stat, invalid: c.rawConfig !== null && config === null, active: config ? activeSources(config, g) : [], collectable: isCollectable(stat, g) };
  });
}

/** 后台页面用：各分类行 + 自动模式此刻会选中的分类。 */
export async function getCollectOverview() {
  const global = await loadGlobalSources();
  const rows = await listCategoryCollectRows(global);
  return { rows, autoPick: pickTargetCategory(rows, global), global };
}

export type CollectTarget = Pick<CategoryCollectRow, "id" | "slug" | "name"> & {
  config: NonNullable<CategoryCollectRow["config"]>;
  active: CollectSourceKey[];
  mode: "auto" | "manual";
  /** 选中时各分类的「已上架 + 待审核」快照（仅自动模式），记进运行记录 */
  snapshot?: { slug: string; total: number; collectable: boolean }[];
};

/** 解析本次采集的目标分类：auto = 选资源最少且已配置的分类；否则为指定分类 id。 */
export async function resolveTarget(choice: "auto" | { categoryId: string }, global: GlobalSources): Promise<CollectTarget> {
  const rows = await listCategoryCollectRows(global);
  if (choice === "auto") {
    const best = pickTargetCategory(rows, global);
    if (!best?.config) throw new DomainError("没有可自动采集的分类：请先在「分类采集配置」里为分类开启采集，并确认对应来源在全局设置里也已开启");
    return {
      id: best.id,
      slug: best.slug,
      name: best.name,
      config: best.config,
      active: best.active,
      mode: "auto",
      snapshot: rows.map((r) => ({ slug: r.slug, total: r.published + r.pending, collectable: r.collectable })),
    };
  }
  const row = rows.find((r) => r.id === choice.categoryId);
  if (!row) throw new DomainError("目标分类不存在，请刷新页面后重选");
  if (!row.config) throw new DomainError(`「${row.name}」${row.invalid ? "的采集配置格式异常，请重新保存" : "未配置，不参与采集"}`);
  if (!row.config.enabled) throw new DomainError(`「${row.name}」的采集已关闭`);
  if (row.active.length === 0) throw new DomainError(`「${row.name}」开启的来源在全局设置里都关着（或 Product Hunt 未配置 Token）`);
  return { id: row.id, slug: row.slug, name: row.name, config: row.config, active: row.active, mode: "manual" };
}

export async function saveCollectConfig(categoryId: string, raw: unknown) {
  const parsed = collectConfigSchema.safeParse(raw);
  if (!parsed.success) return { ok: false as const, error: parsed.error };
  const cat = await repo.findCategoryById(categoryId);
  if (!cat) throw new DomainError("分类不存在或已删除");
  await repo.upsertCollectConfig(categoryId, JSON.parse(JSON.stringify(parsed.data)));
  return { ok: true as const, name: cat.name };
}
