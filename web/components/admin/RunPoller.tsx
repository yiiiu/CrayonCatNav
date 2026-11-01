"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** 后台任务（采集 / AI 审核）进行中时每隔几秒刷新页面数据，结束后自动停止。 */
export function RunPoller({ active, intervalMs = 5000 }: { active: boolean; intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(t);
  }, [active, intervalMs, router]);
  return null;
}
