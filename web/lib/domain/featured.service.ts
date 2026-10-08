import "server-only";
import { replaceFeatured } from "@/lib/data/resource.repo";
import { DomainError } from "./result";

export const FEATURED_MAX = 12;

export async function setFeatured(orderedIds: string[]) {
  const ids = [...new Set(orderedIds.filter(Boolean))];
  if (ids.length > FEATURED_MAX) throw new DomainError(`首页精选最多 ${FEATURED_MAX} 个`);
  await replaceFeatured(ids);
}
