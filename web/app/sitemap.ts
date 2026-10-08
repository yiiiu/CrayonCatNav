import type { MetadataRoute } from "next";
import { listPublishedSlugs } from "@/lib/data/resource.repo";
import { siteConfig } from "@/lib/site";
import { isPubliclyListed, toolMetas } from "@/lib/tools/metas";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteConfig.url;
  const fixed: MetadataRoute.Sitemap = [
    { url: `${base}/` },
    { url: `${base}/resources` },
    { url: `${base}/tools` },
    ...toolMetas.filter(isPubliclyListed).map((t) => ({ url: `${base}/tools/${t.slug}` })),
  ];
  try {
    const resources = await listPublishedSlugs();
    return [...fixed, ...resources.map((r) => ({ url: `${base}/resources/${r.slug}`, lastModified: r.updatedAt }))];
  } catch {
    // 构建期无数据库时退化为固定页面，ISR 会在运行时补齐
    return fixed;
  }
}
