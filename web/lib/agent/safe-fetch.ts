import "server-only";
import { lookup as dnsLookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import type { LookupAddress } from "node:dns";
import { extractOgImage } from "./og-image";
import { checkFetchableUrl, isBlockedAddress } from "./ssrf";

/**
 * 抓取任意外部链接（管理员贴的链接、候选链接可访问性检查）专用：
 * - 只允许 http/https，拒绝内网主机名；
 * - DNS 解析在连接时由自定义 lookup 完成，解析结果含任何私网/回环/链路本地地址即拒绝（同时防 DNS 重绑定）；
 * - 手动跟随重定向（最多 5 次），每一跳重新校验；
 * - 总超时默认 10 秒；响应体超过上限即截断停止读取。
 */

export type SafeFetchResult = { status: number; finalUrl: string; contentType: string; body: string; truncated: boolean };

export class SafeFetchError extends Error {}

type Options = { timeoutMs?: number; maxBytes?: number; maxRedirects?: number; accept?: string };

const UA = "CrayonCatNavBot/1.0 (+https://crayon-cat-nav.vercel.app)";

/** 连接时的 DNS 解析：任何一个解析结果是非公网地址都拒绝。 */
function guardedLookup(
  hostname: string,
  options: { all?: boolean; family?: number | string },
  callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) {
  dnsLookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err, "", 0);
    const list = addresses as LookupAddress[];
    if (list.length === 0 || list.some((a) => isBlockedAddress(a.address))) {
      return callback(Object.assign(new Error("目标解析到内网或本机地址，已拒绝"), { code: "EBLOCKED" }), "", 0);
    }
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

function requestOnce(url: URL, opts: Required<Options>, deadline: number): Promise<{ status: number; location?: string; contentType: string; body: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return reject(new SafeFetchError("请求超时"));
    const mod = url.protocol === "https:" ? https : http;
    const req = mod.request(
      url,
      {
        method: "GET",
        lookup: guardedLookup as never,
        headers: { "user-agent": UA, accept: opts.accept, "accept-encoding": "identity" },
        timeout: remaining,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const contentType = String(res.headers["content-type"] ?? "");
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          return resolve({ status, location: String(res.headers.location), contentType, body: "", truncated: false });
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          if (truncated) return;
          const room = opts.maxBytes - size;
          if (chunk.length >= room) {
            chunks.push(chunk.subarray(0, room));
            size += room;
            truncated = true;
            res.destroy();
            resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8"), truncated });
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        res.on("end", () => resolve({ status, contentType, body: Buffer.concat(chunks).toString("utf8"), truncated }));
        res.on("error", (e) => (truncated ? undefined : reject(e)));
      },
    );
    const timer = setTimeout(() => req.destroy(new SafeFetchError("请求超时")), remaining);
    req.on("close", () => clearTimeout(timer));
    req.on("timeout", () => req.destroy(new SafeFetchError("请求超时")));
    req.on("error", (e) => reject(e instanceof SafeFetchError ? e : new SafeFetchError((e as NodeJS.ErrnoException).code === "EBLOCKED" ? e.message : `无法访问：${(e as NodeJS.ErrnoException).code ?? e.message}`)));
    req.end();
  });
}

export async function safeFetch(input: string, options: Options = {}): Promise<SafeFetchResult> {
  const opts: Required<Options> = {
    timeoutMs: options.timeoutMs ?? 10_000,
    maxBytes: options.maxBytes ?? 1_000_000,
    maxRedirects: options.maxRedirects ?? 5,
    accept: options.accept ?? "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.5",
  };
  const deadline = Date.now() + opts.timeoutMs;
  let current = input;
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    const check = checkFetchableUrl(current);
    if (!check.ok) throw new SafeFetchError(check.reason);
    const r = await requestOnce(check.url, opts, deadline);
    if (r.location) {
      current = new URL(r.location, check.url).toString();
      continue;
    }
    return { status: r.status, finalUrl: check.url.toString(), contentType: r.contentType, body: r.body, truncated: r.truncated };
  }
  throw new SafeFetchError("重定向次数过多");
}

/** 链接可访问性：服务器有正常响应即算可访问（403/429 多为反爬，也算站点存在）；404/410/5xx/网络错误为不可访问。 */
export async function checkLink(url: string): Promise<{ ok: boolean; status: number | null; finalUrl: string | null }> {
  try {
    const r = await safeFetch(url, { maxBytes: 32_000, timeoutMs: 10_000 });
    const ok = r.status > 0 && (r.status < 400 || r.status === 401 || r.status === 403 || r.status === 429);
    return { ok, status: r.status, finalUrl: r.finalUrl };
  } catch {
    return { ok: false, status: null, finalUrl: null };
  }
}

/** 抓官网（或 GitHub 仓库页）的 og:image 作为详情页预览图；任何失败都返回 null，不影响采集。 */
export async function fetchPreviewImage(...urls: (string | null | undefined)[]): Promise<string | null> {
  for (const url of urls) {
    if (!url) continue;
    try {
      const r = await safeFetch(url, { maxBytes: 200_000, timeoutMs: 8_000, accept: "text/html" });
      if (r.status >= 400 || !/html/i.test(r.contentType)) continue;
      const img = extractOgImage(r.body, r.finalUrl);
      if (img) return img;
    } catch {
      /* 抓不到就试下一个 */
    }
  }
  return null;
}
