/**
 * SSRF 防护的地址判定（纯函数）：拒绝私网、回环、链路本地、CGNAT、组播、保留与文档地址，
 * IPv6 的 IPv4 映射 / NAT64 / 6to4 地址按内嵌的 IPv4 再判一次。
 */
import { isIP } from "node:net";

type Cidr4 = [number, number]; // [网络地址（32 位整数）, 前缀长度]

const BLOCKED_V4: Cidr4[] = (
  [
    ["0.0.0.0", 8], // 本网络
    ["10.0.0.0", 8], // 私网
    ["100.64.0.0", 10], // CGNAT
    ["127.0.0.0", 8], // 回环
    ["169.254.0.0", 16], // 链路本地（含云厂商元数据 169.254.169.254）
    ["172.16.0.0", 12], // 私网
    ["192.0.0.0", 24], // IETF 协议分配
    ["192.0.2.0", 24], // 文档
    ["192.88.99.0", 24], // 6to4 中继
    ["192.168.0.0", 16], // 私网
    ["198.18.0.0", 15], // 基准测试
    ["198.51.100.0", 24], // 文档
    ["203.0.113.0", 24], // 文档
    ["224.0.0.0", 4], // 组播
    ["240.0.0.0", 4], // 保留（含广播）
  ] as const
).map(([ip, len]) => [v4ToInt(ip), len]);

function v4ToInt(ip: string): number {
  return ip.split(".").reduce((acc, p) => (acc << 8) + Number(p), 0) >>> 0;
}

function inCidr4(n: number, [net, len]: Cidr4) {
  if (len === 0) return true;
  const mask = (~0 << (32 - len)) >>> 0;
  return (n & mask) >>> 0 === (net & mask) >>> 0;
}

function isBlockedV4(ip: string) {
  const n = v4ToInt(ip);
  return BLOCKED_V4.some((c) => inCidr4(n, c));
}

/** 把 IPv6 展开成 8 个 16 位整数；非法返回 null。支持末尾内嵌 IPv4 写法。 */
function expandV6(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf("%");
  if (zone >= 0) s = s.slice(0, zone);
  // 末尾是点分 IPv4 时换算成两个 16 位组
  const m = s.match(/^(.*:)(\d+\.\d+\.\d+\.\d+)$/);
  if (m) {
    if (isIP(m[2]) !== 4) return null;
    const n = v4ToInt(m[2]);
    s = `${m[1]}${(n >>> 16).toString(16)}:${(n & 0xffff).toString(16)}`;
  }
  const parts = s.split("::");
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(":") : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(":") : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (parts.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups.map((g) => Number.parseInt(g, 16));
}

const v4FromGroups = (hi: number, lo: number) => `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;

function isBlockedV6(ip: string) {
  const g = expandV6(ip);
  if (!g) return true; // 解析不了就拒绝
  if (g.every((x) => x === 0)) return true; // ::
  if (g.slice(0, 7).every((x) => x === 0) && g[7] === 1) return true; // ::1
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 唯一本地
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 链路本地
  if ((g[0] & 0xffc0) === 0xfec0) return true; // fec0::/10 站点本地（已废弃）
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 组播
  if (g[0] === 0x2001 && g[1] === 0x0db8) return true; // 2001:db8::/32 文档
  // ::ffff:a.b.c.d（IPv4 映射）与 ::a.b.c.d（IPv4 兼容，已废弃）
  if (g.slice(0, 5).every((x) => x === 0) && (g[5] === 0xffff || g[5] === 0)) return isBlockedV4(v4FromGroups(g[6], g[7]));
  // 64:ff9b::/96 NAT64
  if (g[0] === 0x64 && g[1] === 0xff9b && g.slice(2, 6).every((x) => x === 0)) return isBlockedV4(v4FromGroups(g[6], g[7]));
  // 2002::/16 6to4：第 2、3 组是内嵌 IPv4
  if (g[0] === 0x2002) return isBlockedV4(v4FromGroups(g[1], g[2]));
  return false;
}

/** 该 IP 是否禁止访问（非公网地址）。不是合法 IP 也视为禁止。 */
export function isBlockedAddress(ip: string): boolean {
  const bare = ip.replace(/^\[|\]$/g, "");
  const kind = isIP(bare);
  if (kind === 4) return isBlockedV4(bare);
  if (kind === 6) return isBlockedV6(bare);
  return true;
}

/** 主机名层面的预检：明显的内网名直接拒绝（真正的判定在 DNS 解析之后）。 */
export function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (!h) return true;
  if (isIP(h)) return isBlockedAddress(h);
  if (h === "localhost" || h.endsWith(".localhost")) return true;
  if (h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || h.endsWith(".home.arpa")) return true;
  if (!h.includes(".")) return true; // 单标签主机名多为内网
  return false;
}

/** 允许抓取的 URL：仅 http/https、无账号密码、主机名通过预检。 */
export function checkFetchableUrl(input: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "链接格式不正确" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { ok: false, reason: "只支持 http / https 链接" };
  if (url.username || url.password) return { ok: false, reason: "链接不能包含账号密码" };
  if (isBlockedHostname(url.hostname)) return { ok: false, reason: "不允许访问内网或本机地址" };
  return { ok: true, url };
}
