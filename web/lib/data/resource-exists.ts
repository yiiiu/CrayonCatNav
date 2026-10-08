import { Pool } from "pg";

/**
 * 供 proxy.ts 使用的轻量存在性检查（不经 Prisma、不引 server-only）。
 * 原因：Cache Components 下首次访问未预渲染的 slug 会先流式输出外壳，
 * 页面内的 notFound() 只能得到 200 + noindex；在 proxy 里先判断才能返回真实 404。
 */
const globalForPool = globalThis as unknown as { resourcePool?: Pool };
const pool = (globalForPool.resourcePool ??= new Pool({ connectionString: process.env.DATABASE_URL, max: 2 }));

/** 返回 null 表示查询失败（交给页面自行处理，不误报 404）。 */
export async function publishedSlugExists(slug: string): Promise<boolean | null> {
  try {
    const r = await pool.query(`SELECT 1 FROM "Resource" WHERE slug = $1 AND status = 'published' LIMIT 1`, [slug]);
    return (r.rowCount ?? 0) > 0;
  } catch (e) {
    console.error("[proxy] 资源存在性检查失败", e);
    return null;
  }
}
