"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Select } from "@/components/ui";
import { platformLabels, platforms } from "@/lib/validation/resource-details";
import { buildSearchHref, type PublicSearchParams } from "@/lib/validation/search";

const options = [{ value: "", label: "全部平台" }, ...platforms.map((p) => ({ value: p, label: platformLabels[p] }))];

/** 平台筛选下拉：选中即跳转，保留其余筛选条件。 */
export function PlatformSelect({ current, className }: { current: PublicSearchParams; className?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <Select
      aria-label="平台"
      className={className}
      options={options}
      value={current.platform ?? ""}
      searchable={false}
      onValueChange={(v) =>
        startTransition(() =>
          router.push(buildSearchHref(current, { platform: (v || undefined) as PublicSearchParams["platform"] }), { scroll: false }),
        )
      }
    />
  );
}
