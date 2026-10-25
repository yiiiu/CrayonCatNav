/**
 * 白名单来源的 HTTP 读取：目标主机写死在各来源模块里，不接受外部输入的主机，
 * 所以这里只做超时与体积限制；任意链接抓取请用 safe-fetch。
 */

const UA = "CrayonCatNavBot/1.0 (+https://crayon-cat-nav.vercel.app)";

export class SourceError extends Error {}

export async function fetchText(
  url: string,
  init: { headers?: Record<string, string>; method?: string; body?: string; timeoutMs?: number; maxBytes?: number } = {},
): Promise<string> {
  const res = await fetch(url, {
    method: init.method ?? "GET",
    body: init.body,
    headers: { "user-agent": UA, ...init.headers },
    signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
    cache: "no-store",
  }).catch((e: unknown) => {
    throw new SourceError(e instanceof Error && e.name === "TimeoutError" ? "请求超时" : "网络错误");
  });
  if (!res.ok) throw new SourceError(`HTTP ${res.status}`);
  const max = init.maxBytes ?? 2_000_000;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > max) throw new SourceError("响应过大");
  const text = await res.text();
  if (text.length > max) throw new SourceError("响应过大");
  return text;
}

export async function fetchJson(url: string, init: Parameters<typeof fetchText>[1] = {}): Promise<unknown> {
  const text = await fetchText(url, { ...init, headers: { accept: "application/json", ...init.headers } });
  try {
    return JSON.parse(text);
  } catch {
    throw new SourceError("返回的不是 JSON");
  }
}

/** 解析时间：非法返回 null。 */
export function toDate(v: unknown): Date | null {
  if (typeof v !== "string" || !v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
export const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
export const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** https 外链才保留（http 的官网不能直接上架，交给人工补）。 */
export function httpsOrNull(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** ISO 时间（N 天前），用于 updated_since / pushed:> 之类的参数。 */
export function daysAgoIso(days: number, now = new Date()) {
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}
