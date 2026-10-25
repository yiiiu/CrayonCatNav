import type { TrackPayload } from "../validation/analytics";
import { hostOfReferrer } from "./traffic";

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

/**
 * 页面浏览上报：只发路径（不含 query / hash）和来源主机名，完整 referrer 不离开浏览器。
 * 首次加载用 document.referrer；之后的客户端路由切换记为站内跳转（ref = 本站主机名）。
 */
export function trackPageView(pathname: string, firstLoad: boolean): void {
  if (typeof window === "undefined") return;
  const ref = firstLoad ? hostOfReferrer(document.referrer) : window.location.hostname;
  trackEvent({ eventType: "page_view", path: pathname, ...(ref ? { ref } : {}) });
}
