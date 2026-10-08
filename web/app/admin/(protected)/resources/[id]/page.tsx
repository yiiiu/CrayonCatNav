import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminTop } from "@/components/admin/AdminTop";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { findById } from "@/lib/data/resource.repo";
import { adminListCategories, adminListTags, adminListTools } from "@/lib/data/taxonomy.repo";
import { deleteResourceAction, saveResourceAction } from "../../actions";

export const metadata = { title: "编辑资源" };

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> };

export default async function EditResourcePage({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const [r, categories, tags, tools] = await Promise.all([findById(id), adminListCategories(), adminListTags(), adminListTools()]);
  if (!r) notFound();
  return (
    <>
      <AdminTop title={`编辑：${r.name}`}>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Link href="/admin/resources">‹ 返回列表</Link>
          <form action={deleteResourceAction.bind(null, r.id)}>
            <ConfirmButton message={`确定永久删除「${r.name}」？此操作不可恢复。`} style={{ font: "800 14px var(--font)", color: "#9b1e1e", background: "none", border: 0, textDecoration: "underline", cursor: "pointer", minHeight: 44 }}>
              删除资源
            </ConfirmButton>
          </form>
        </div>
      </AdminTop>
      <ResourceForm
        action={saveResourceAction.bind(null, r.id)}
        categories={categories}
        tags={tags}
        tools={tools}
        notice={sp.created ? "已创建" : undefined}
        initial={{
          slug: r.slug,
          name: r.name,
          summary: r.summary,
          description: r.description,
          categoryId: r.categoryId,
          websiteUrl: r.websiteUrl ?? "",
          githubUrl: r.githubUrl ?? "",
          iconUrl: r.iconUrl ?? "",
          pricingType: r.pricingType,
          status: r.status,
          tagIds: r.tags.map((t) => t.tagId),
          toolIds: r.tools.map((t) => t.toolId),
        }}
      />
    </>
  );
}
