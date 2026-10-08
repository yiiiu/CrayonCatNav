import { AdminTop } from "@/components/admin/AdminTop";
import { FeaturedEditor } from "@/components/admin/FeaturedEditor";
import { Card } from "@/components/ui";
import { adminListFeatureCandidates, adminListFeatured } from "@/lib/data/resource.repo";
import { FEATURED_MAX } from "@/lib/domain/featured.service";
import { statusLabels } from "@/lib/validation/resource";
import { saveFeaturedAction } from "../actions";

export const metadata = { title: "首页精选" };

export default async function FeaturedPage() {
  const [featured, candidates] = await Promise.all([adminListFeatured(), adminListFeatureCandidates()]);
  const key = featured.map((f) => f.id).join(",");
  return (
    <>
      <AdminTop title="首页精选" />
      <Card>
        <FeaturedEditor
          key={key}
          action={saveFeaturedAction}
          max={FEATURED_MAX}
          initial={featured.map((f) => ({
            id: f.id,
            name: f.name,
            note: f.status !== "published" ? `${statusLabels[f.status]}，保存后移出` : f.category.name,
          }))}
          candidates={candidates}
        />
      </Card>
    </>
  );
}
