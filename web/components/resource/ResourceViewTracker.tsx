"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics/track";

/** 详情页浏览埋点：客户端首渲染时记录一次 resource_view，不收集任何敏感数据。 */
export function ResourceViewTracker({ slug }: { slug: string }) {
  useEffect(() => {
    trackEvent({ eventType: "resource_view", resourceId: slug });
  }, [slug]);

  return null;
}
