import type { TrackPayload } from "../validation/analytics";

/**
 * 客户端轻量匿名埋点上报。
 * 绝不上报任何用户输入、API Key 或 env。
 * 失败静默处理，绝不抛出未经捕获的异常打断 UI。
 */
export function trackEvent(payload: TrackPayload): void {
  if (typeof window === "undefined") return;

  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const ok = navigator.sendBeacon("/api/track", blob);
      if (ok) return;
    }

    void fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      // 忽略网络或上报失败
    });
  } catch {
    // 降级与兜底静默
  }
}
