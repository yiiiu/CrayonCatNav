import Link from "next/link";
import { AdminTop } from "@/components/admin/AdminTop";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { adminListCategories, adminListTags, adminListTools } from "@/lib/data/taxonomy.repo";
import { saveResourceAction } from "../../actions";

export const metadata = { title: "新增资源" };

export default async function NewResourcePage() {
  const [categories, tags, tools] = await Promise.all([adminListCategories(), adminListTags(), adminListTools()]);
  return (
    <>
      <AdminTop title="新增资源">
        <Link href="/admin/resources">‹ 返回列表</Link>
      </AdminTop>
      <ResourceForm
        action={saveResourceAction.bind(null, null)}
        categories={categories}
        tags={tags}
        tools={tools}
        initial={{
          slug: "", name: "", summary: "", description: "", categoryId: "", websiteUrl: "", githubUrl: "", iconUrl: "",
          pricingType: "unknown", status: "draft", tagIds: [], toolIds: [],
        }}
      />
    </>
  );
}
