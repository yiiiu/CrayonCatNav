/**
 * 自建访问统计的纯函数（零 DOM、零数据库依赖）：路径归一化、来源分类、设备粗分、机器人识别、统计日。
 * 只处理域名与路径，不接触完整来源 URL、IP 或 UA 原文的持久化。
 */

export const TRAFFIC_SOURCES = ["direct", "internal", "google", "bing", "other_search", "social", "referral"] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

export const DEVICES = ["desktop", "mobile", "tablet"] as const;
export type Device = (typeof DEVICES)[number];

export const sourceLabels: Record<TrafficSource, string> = {
  direct: "直接访问",
  internal: "站内跳转",
  google: "Google",
  bing: "Bing",
  other_search: "其他搜索引擎",
  social: "社交平台",
  referral: "外链",
};

export const deviceLabels: Record<Device, string> = { desktop: "桌面", mobile: "手机", tablet: "平板" };

/** 统计口径时区：按北京时间自然日聚合 */
export const STATS_TZ = "Asia/Shanghai";

/** 返回 tz 时区下的自然日（UTC 零点的 Date，供 @db.Date 列使用）。 */
export function statDay(now: Date = new Date(), tz: string = STATS_TZ): Date {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return new Date(`${parts}T00:00:00.000Z`);
}

/** 自然日加减（UTC 零点对齐）。 */
export function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * 86_400_000);
}

export const isoDay = (d: Date) => d.toISOString().slice(0, 10);

const EXCLUDED_PREFIXES = ["/admin", "/api", "/_next"];
const SEGMENT = /^[a-z0-9-]{1,64}$/;

/**
 * 路径归一化：去掉 query / hash，小写，合并重复斜杠，去掉末尾斜杠。
 * 只接受公开站点形态的路径（最多两段、每段为 slug 字符），后台 / 接口 / 资源文件返回 null（不计入）。
 * 白名单形态可以防止任意路径刷爆聚合表。
 */
export function normalizePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let p = raw.trim();
  if (!p.startsWith("/") || p.length > 300) return null;
  p = p.split(/[?#]/, 1)[0].toLowerCase().replace(/\/{2,}/g, "/");
  if (p.length > 1) p = p.replace(/\/+$/, "");
  if (p === "") p = "/";
  if (EXCLUDED_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`))) return null;
  if (p === "/") return p;
  const segs = p.slice(1).split("/");
  if (segs.length > 2 || !segs.every((s) => SEGMENT.test(s))) return null;
  return p;
}

/** 规范化主机名：小写、去端口、去 www. / m. 前缀；不合法返回空串。 */
export function cleanHost(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const h = raw.trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
  if (!h || h.length > 253 || !/^[a-z0-9.-]+$/.test(h) || !h.includes(".")) return "";
  return h.replace(/^(www|m|l|lm)\./, "");
}

/** 从完整来源 URL 取主机名（只在浏览器端调用，完整 URL 不离开浏览器）。 */
export function hostOfReferrer(referrer: string): string {
  if (!referrer) return "";
  try {
    const u = new URL(referrer);
    return u.protocol === "http:" || u.protocol === "https:" ? u.hostname : "";
  } catch {
    return "";
  }
}

const OTHER_SEARCH = [
  "baidu.com", "so.com", "sogou.com", "sm.cn", "yandex.ru", "yandex.com", "duckduckgo.com", "search.yahoo.com",
  "yahoo.co.jp", "ecosia.org", "search.brave.com", "naver.com", "seznam.cz", "qwant.com", "startpage.com", "toutiao.com",
];
const SOCIAL = [
  "twitter.com", "x.com", "t.co", "facebook.com", "instagram.com", "threads.net", "linkedin.com", "lnkd.in", "reddit.com",
  "news.ycombinator.com", "youtube.com", "t.me", "telegram.org", "discord.com", "weibo.com", "weibo.cn", "t.cn",
  "zhihu.com", "douban.com", "bilibili.com", "b23.tv", "xiaohongshu.com", "xhslink.com", "douyin.com", "v2ex.com",
  "juejin.cn", "weixin.qq.com", "qq.com", "mastodon.social", "bsky.app",
];

const matches = (host: string, list: string[]) => list.some((d) => host === d || host.endsWith(`.${d}`));
const isGoogle = (h: string) => /(^|\.)google\.[a-z.]{2,8}$/.test(h) && !h.startsWith("mail.") && !h.startsWith("docs.");
const isBing = (h: string) => h === "bing.com" || h.endsWith(".bing.com");

/**
 * 来源分类：只看主机名。selfHost 为本站主机名（同站视为站内跳转）。
 * 返回分类与要入库的域名（Google / Bing / 直接 / 站内不存域名）。
 */
export function classifySource(refHost: string, selfHost: string): { source: TrafficSource; refDomain: string } {
  const h = cleanHost(refHost);
  if (!h) return { source: "direct", refDomain: "" };
  const self = cleanHost(selfHost);
  if (self && (h === self || h.endsWith(`.${self}`))) return { source: "internal", refDomain: "" };
  if (isGoogle(h)) return { source: "google", refDomain: "" };
  if (isBing(h)) return { source: "bing", refDomain: "" };
  if (matches(h, OTHER_SEARCH)) return { source: "other_search", refDomain: h };
  if (matches(h, SOCIAL)) return { source: "social", refDomain: h };
  return { source: "referral", refDomain: h };
}

/** 设备粗分（UA 规则）：iPadOS 桌面模式会被识别为桌面，属已知误差。 */
export function deviceOf(ua: string): Device {
  const s = ua || "";
  if (/iPad|Tablet|PlayBook|Silk|Kindle|(Android(?!.*Mobile))/i.test(s)) return "tablet";
  if (/Mobi|iPhone|iPod|Android|Windows Phone|HarmonyOS.*Phone/i.test(s)) return "mobile";
  return "desktop";
}

const BOT_UA =
  /bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|slackbot|vercel|lighthouse|pagespeed|headless|phantomjs|puppeteer|playwright|selenium|curl|wget|python-requests|python-urllib|httpx|aiohttp|go-http-client|okhttp|java\/|libwww|axios|node-fetch|undici|scrapy|monitor|uptime|pingdom|preview/i;

/** 机器人 / 预渲染 / 脚本请求：不计入统计。空 UA 也视为机器人。 */
export function isBotUA(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true;
  return BOT_UA.test(ua);
}
