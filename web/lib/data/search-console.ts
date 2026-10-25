import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { GOOGLE_TOKEN_URL, buildJwtAssertion, readServiceAccount } from "@/lib/analytics/google-auth";
import {
  type SearchSummary,
  bingSummary,
  gscRange,
  gscSummary,
  parseBingStats,
  parseGscRows,
} from "@/lib/analytics/search-parse";

/**
 * 搜索引擎站长数据（只在服务端运行）：
 * - Google Search Console：服务账号 JWT 换 access token，调 searchAnalytics.query；
 * - Bing Webmaster：API Key 调 GetRankAndTrafficStats / GetQueryStats / GetPageStats。
 * 结果缓存约 6 小时；失败时抛出不含密钥的通用错误，不缓存，由调用方降级展示。
 * 密钥只从 process.env 读取，绝不作为参数、日志或返回值出现。
 */

export type SearchPanel =
  | { state: "unconfigured" }
  | { state: "error"; message: string }
  | { state: "ok"; data: SearchSummary };

export const searchConsoleTag = "search-console";
const TIMEOUT = 10_000;

function cache6h() {
  cacheLife({ stale: 3600, revalidate: 6 * 3600, expire: 24 * 3600 });
  cacheTag(searchConsoleTag);
}

/* ---------------- Google ---------------- */

export function gscConfigured(): boolean {
  return !!process.env.GSC_SITE_URL?.trim() && readServiceAccount(process.env) !== null;
}

async function googleToken(): Promise<string> {
  const sa = readServiceAccount(process.env);
  if (!sa) throw new Error("未配置服务账号");
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: buildJwtAssertion(sa),
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Google 授权失败（HTTP ${res.status}）`);
  const json = (await res.json()) as { access_token?: unknown };
  if (typeof json.access_token !== "string") throw new Error("Google 授权响应异常");
  return json.access_token;
}

async function loadGsc(siteUrl: string): Promise<SearchSummary> {
  "use cache";
  cache6h();
  const token = await googleToken();
  const range = gscRange();
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const query = async (dimensions: string[], rowLimit: number) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ startDate: range.start, endDate: range.end, dimensions, rowLimit, type: "web", dataState: "all" }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!res.ok) {
      throw new Error(res.status === 403 ? "服务账号没有该站点权限（GSC 里把服务账号邮箱加为用户）" : `GSC 查询失败（HTTP ${res.status}）`);
    }
    return parseGscRows(await res.json());
  };
  const [totals, queries, pages] = await Promise.all([query([], 1), query(["query"], 10), query(["page"], 10)]);
  return gscSummary(range, totals, queries, pages);
}

export async function getGscPanel(): Promise<SearchPanel> {
  if (!gscConfigured()) return { state: "unconfigured" };
  try {
    return { state: "ok", data: await loadGsc(process.env.GSC_SITE_URL!.trim()) };
  } catch (e) {
    return { state: "error", message: safeMessage(e) };
  }
}

/* ---------------- Bing ---------------- */

export function bingConfigured(): boolean {
  return !!process.env.BING_WEBMASTER_API_KEY?.trim() && !!process.env.BING_SITE_URL?.trim();
}

async function loadBing(siteUrl: string): Promise<SearchSummary> {
  "use cache";
  cache6h();
  const apikey = process.env.BING_WEBMASTER_API_KEY?.trim();
  if (!apikey) throw new Error("未配置 API Key");
  const call = async (method: string) => {
    const url = `https://ssl.bing.com/webmaster/api.svc/json/${method}?${new URLSearchParams({ siteUrl, apikey })}`;
    const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(TIMEOUT) });
    if (!res.ok) throw new Error(`Bing ${method} 失败（HTTP ${res.status}）`);
    return parseBingStats(await res.json());
  };
  const [traffic, queries, pages] = await Promise.all([
    call("GetRankAndTrafficStats"),
    call("GetQueryStats"),
    call("GetPageStats"),
  ]);
  return bingSummary(new Date(), traffic, queries, pages);
}

export async function getBingPanel(): Promise<SearchPanel> {
  if (!bingConfigured()) return { state: "unconfigured" };
  try {
    return { state: "ok", data: await loadBing(process.env.BING_SITE_URL!.trim()) };
  } catch (e) {
    return { state: "error", message: safeMessage(e) };
  }
}

/** 只透出我们自己构造的错误文案；网络层错误统一成通用描述，避免把 URL（含 apikey）带出去。 */
function safeMessage(e: unknown): string {
  if (e instanceof Error && /^(Google|GSC|Bing|服务账号|未配置)/.test(e.message)) return e.message;
  if (e instanceof Error && e.name === "TimeoutError") return "请求超时";
  return "暂时取不到数据";
}
