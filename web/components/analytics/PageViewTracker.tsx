"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { trackPageView } from "@/lib/analytics/track";

/** 前台页面浏览埋点：仅挂在公开布局里，后台不加载；每次路径变化上报一次。 */
export function PageViewTracker() {
  const pathname = usePathname();
  const first = useRef(true);
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname || pathname === last.current) return;
    last.current = pathname;
    trackPageView(pathname, first.current);
    first.current = false;
  }, [pathname]);
  return null;
}
