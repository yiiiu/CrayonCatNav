"use client";

import { ButtonLink, Card } from "@/components/ui";
import { trackEvent } from "@/lib/analytics/track";
import { isToolSlug } from "@/lib/tools/metas";
import { deriveToolPrefill, type PrefillSourceResource } from "@/lib/tools/prefill";
import { getTool } from "@/lib/tools/registry";
import styles from "./resource.module.css";

/** 详情 → 工具的直达入口；只展示注册表内且公开的工具。带非敏感预填参数并上报点击埋点。 */
export function RelatedToolCTA({
  toolSlug,
  resource,
}: {
  toolSlug: string;
  resource?: PrefillSourceResource;
}) {
  const tool = getTool(toolSlug);
  if (!tool || tool.defaultStatus === "hidden") return null;

  let href = `/tools/${tool.slug}`;
  if (resource && isToolSlug(tool.slug)) {
    const qs = deriveToolPrefill(tool.slug, resource).toString();
    if (qs) href += `?${qs}`;
  }

  function handleClick() {
    if (!tool) return;
    trackEvent({
      eventType: "resource_to_tool_click",
      toolId: tool.slug,
      resourceId: resource?.slug,
    });
  }

  return (
    <Card className={styles.hilite}>
      <div>
        <b>关联工具：{tool.name}</b>
        <small>{tool.description}</small>
      </div>
      <ButtonLink href={href} onClick={handleClick}>
        打开{tool.name} →
      </ButtonLink>
    </Card>
  );
}
