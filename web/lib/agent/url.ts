/**
 * 采集 Agent 的 URL 规范化（纯函数，零依赖）。
 * 规范化键用于去重：小写 host、去 www、去默认端口、去尾斜杠、去 hash 与追踪参数；
 * GitHub 仓库统一归一为 github.com/owner/repo（忽略 /tree/...、.git 等）。
 */

/** 常见追踪参数：一律去掉；其余查询参数保留并按键排序。 */
const TRACKING_PARAMS = new Set([
  "ref",
  "ref_src",
  "source",
  "via",
  "fbclid",
  "gclid",
  "dclid",
  "msclkid",
  "yclid",
  "mc_cid",
  "mc_eid",
  "igshid",
  "spm",
  "_ga",
  "_gl",
]);

const isTrackingParam = (key: string) => key.toLowerCase().startsWith("utm_") || TRACKING_PARAMS.has(key.toLowerCase());

/** GitHub 下非仓库的一级路径（这些不是 owner）。 */
const GITHUB_RESERVED = new Set([
  "about",
  "apps",
  "collections",
  "enterprise",
  "explore",
  "features",
  "issues",
  "login",
  "marketplace",
  "new",
  "notifications",
  "orgs",
  "pricing",
  "pulls",
  "search",
  "settings",
  "sponsors",
  "topics",
  "trending",
  "users",
]);

const NAME_RE = /^[A-Za-z0-9_.-]+$/;

function parse(input: string): URL | null {
  const raw = input.trim();
  if (!raw) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (!u.hostname) return null;
    return u;
  } catch {
    return null;
  }
}

function bareHost(u: URL) {
  return u.hostname.toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

/** 从任意 GitHub 链接取 owner/repo（小写）；不是仓库链接返回 null。 */
export function githubRepoOf(input: string): string | null {
  const u = parse(input);
  if (!u) return null;
  const host = bareHost(u);
  if (host !== "github.com") return null;
  const [owner, repoRaw] = u.pathname.split("/").filter(Boolean);
  if (!owner || !repoRaw) return null;
  const repo = repoRaw.replace(/\.git$/i, "");
  if (GITHUB_RESERVED.has(owner.toLowerCase())) return null;
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo) || repo === "." || repo === "..") return null;
  return `${owner}/${repo}`.toLowerCase();
}

/** 规范的 GitHub 仓库链接 https://github.com/owner/repo（保留原大小写以便展示）。 */
export function canonicalGithubUrl(input: string): string | null {
  const u = parse(input);
  if (!u || bareHost(u) !== "github.com" || !githubRepoOf(input)) return null;
  const [owner, repo] = u.pathname.split("/").filter(Boolean);
  return `https://github.com/${owner}/${repo.replace(/\.git$/i, "")}`;
}

/** 规范化键：用于去重比较，不用于展示。非法链接返回 null。 */
export function normalizeUrl(input: string): string | null {
  const gh = githubRepoOf(input);
  if (gh) return `github.com/${gh}`;
  const u = parse(input);
  if (!u) return null;
  const host = bareHost(u);
  const port = u.port && !((u.protocol === "https:" && u.port === "443") || (u.protocol === "http:" && u.port === "80")) ? `:${u.port}` : "";
  let path = u.pathname.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
  if (/^\/index\.html?$/i.test(path)) path = "";
  const params = [...u.searchParams.entries()].filter(([k]) => !isTrackingParam(k)).sort(([a], [b]) => a.localeCompare(b));
  const qs = params.length ? `?${new URLSearchParams(params).toString()}` : "";
  return `${host}${port}${path}${qs}`;
}

/** 一个条目的全部去重键（官网 + GitHub），去空去重。 */
export function urlKeysOf(...urls: (string | null | undefined)[]): string[] {
  const keys = new Set<string>();
  for (const u of urls) {
    if (!u) continue;
    const k = normalizeUrl(u);
    if (k) keys.add(k);
  }
  return [...keys];
}

/** 是否 https 链接（资源表外链仅允许 https）。 */
export function isHttpsUrl(input: string | null | undefined): input is string {
  if (!input) return false;
  try {
    return new URL(input).protocol === "https:";
  } catch {
    return false;
  }
}
