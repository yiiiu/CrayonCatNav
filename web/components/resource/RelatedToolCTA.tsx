import { ButtonLink, Card } from "@/components/ui";
import { getTool } from "@/lib/tools/registry";
import styles from "./resource.module.css";

/** 详情 → 工具的直达入口；只展示注册表内且公开的工具。 */
export function RelatedToolCTA({ toolSlug }: { toolSlug: string }) {
  const tool = getTool(toolSlug);
  if (!tool || tool.defaultStatus === "hidden") return null;
  return (
    <Card className={styles.hilite}>
      <div>
        <b>关联工具：{tool.name}</b>
        <small>{tool.description}</small>
      </div>
      <ButtonLink href={`/tools/${tool.slug}`}>打开{tool.name} →</ButtonLink>
    </Card>
  );
}
