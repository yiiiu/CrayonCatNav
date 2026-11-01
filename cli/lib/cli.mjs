/**
 * 蜡笔猫 CLI：HTTP API（/api/agent/v1）的薄客户端，零依赖。
 * 规格 docs/spec/Agent接入方案.md §10 第三期。
 */

export const DEFAULT_BASE = "https://www.crayoncat.online";
export const VERSION = "0.1.0";

export const HELP = `蜡笔猫导航 CLI ${VERSION}

用法：
  crayoncat categories                    列出分类
  crayoncat tags [--category <slug>]      列出常用标签
  crayoncat search [关键词] [选项]         筛选资源
      --category <slug>   分类
      --tag <slug>        标签，可重复
      --pricing <type>    free | freemium | paid
      --limit <n>         1–20，默认 10
      --cursor <c>        翻页
  crayoncat show <slug>                   资源详情与快速上手

通用选项：
  --json        输出原始 JSON（给 Agent / 脚本用）
  --base <url>  服务地址，默认 ${DEFAULT_BASE}（也可用环境变量 CRAYONCAT_BASE_URL）
  -h, --help    帮助
  -v, --version 版本

示例：
  crayoncat search "React 无样式组件" --category ui-components --limit 5
  crayoncat show shadcn-ui --json`;

const VALUE_FLAGS = new Set(["category", "tag", "pricing", "limit", "cursor", "base"]);
const BOOL_FLAGS = new Set(["json", "help", "version"]);
const SHORT = { h: "help", v: "version" };

/** 解析参数：返回 { command, positional, flags }，未知选项抛错。 */
export function parseArgs(argv) {
  const flags = { tag: [] };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }
    let name = null;
    let inline;
    if (a.startsWith("--")) [name, inline] = a.slice(2).split(/=(.*)/s, 2);
    else if (/^-[a-z]$/.test(a)) name = SHORT[a[1]] ?? a.slice(1);
    if (name === null) {
      positional.push(a);
      continue;
    }
    if (BOOL_FLAGS.has(name)) flags[name] = true;
    else if (VALUE_FLAGS.has(name)) {
      const v = inline ?? argv[++i];
      if (v === undefined || (inline === undefined && v.startsWith("--"))) throw new Error(`选项 --${name} 需要一个值`);
      if (name === "tag") flags.tag.push(v);
      else flags[name] = v;
    } else throw new Error(`未知选项 ${a}，用 crayoncat --help 查看用法`);
  }
  const [command, ...rest] = positional;
  return { command, positional: rest, flags };
}

/** 组装请求地址。 */
export function buildUrl(base, command, positional, flags) {
  const api = `${base.replace(/\/$/, "")}/api/agent/v1`;
  const qs = new URLSearchParams();
  switch (command) {
    case "categories":
      return `${api}/categories`;
    case "tags":
      if (flags.category) qs.set("category", flags.category);
      return `${api}/tags${qs.size ? `?${qs}` : ""}`;
    case "search": {
      const q = positional.join(" ").trim();
      if (q) qs.set("q", q);
      for (const k of ["category", "pricing", "limit", "cursor"]) if (flags[k]) qs.set(k, flags[k]);
      for (const t of flags.tag) qs.append("tag", t);
      return `${api}/resources${qs.size ? `?${qs}` : ""}`;
    }
    case "show": {
      const slug = positional[0];
      if (!slug) throw new Error("用法：crayoncat show <slug>");
      return `${api}/resources/${encodeURIComponent(slug)}`;
    }
    default:
      throw new Error(`未知命令 ${command}，用 crayoncat --help 查看用法`);
  }
}

const PRICING_LABEL = { free: "免费", freemium: "免费+付费", paid: "付费" };

/** 人类可读输出。 */
export function format(command, data) {
  const lines = [];
  if (command === "categories") {
    for (const c of data.categories) lines.push(`${c.slug.padEnd(20)} ${c.name}（${c.count}）`);
  } else if (command === "tags") {
    lines.push(data.tags.map((t) => `${t.slug}（${t.count}）`).join("  ") || "没有标签");
  } else if (command === "search") {
    if (!data.items.length) return "没有找到资源。试试去掉关键词只按分类看，或换个更短的词。";
    for (const r of data.items) {
      const meta = [r.category, r.pricing && PRICING_LABEL[r.pricing], r.tags.join(", ")].filter(Boolean).join(" · ");
      lines.push(`${r.name}  [${r.slug}]`, `  ${r.summary}`, `  ${meta}`, `  ${r.githubUrl || r.websiteUrl || r.url}`, "");
    }
    lines.push(`共 ${data.total} 个${data.nextCursor ? `，下一页加 --cursor ${data.nextCursor}` : ""}`);
  } else if (command === "show") {
    const r = data;
    lines.push(`${r.name}  [${r.slug}]`, r.summary, "");
    lines.push(`分类：${r.category.name}（${r.category.slug}）`);
    if (r.tags.length) lines.push(`标签：${r.tags.map((t) => t.name).join("、")}`);
    if (r.pricing) lines.push(`价格：${PRICING_LABEL[r.pricing]}${r.pricingNote ? `，${r.pricingNote}` : ""}`);
    if (r.platforms.length) lines.push(`平台：${r.platforms.join(", ")}`);
    if (r.websiteUrl) lines.push(`官网：${r.websiteUrl}`);
    if (r.githubUrl) lines.push(`GitHub：${r.githubUrl}`);
    lines.push(`详情：${r.url}`);
    if (r.highlights.length) lines.push("", "核心功能：", ...r.highlights.map((h) => `  - ${h}`));
    if (r.useCases.length) lines.push("", "适用场景：", ...r.useCases.map((h) => `  - ${h}`));
    if (r.quickstart) lines.push("", "快速上手：", ...r.quickstart.split("\n").map((l) => `  ${l}`));
    if (r.siteTools.length) lines.push("", "站内工具：", ...r.siteTools.map((t) => `  ${t.name}：${t.url}`));
  }
  return lines.join("\n").trimEnd();
}

/** 运行一次命令，返回退出码。io 可注入，便于测试。 */
export async function run(argv, { env = process.env, fetchImpl = fetch, out = console.log, err = console.error } = {}) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    err(e.message);
    return 2;
  }
  const { command, positional, flags } = parsed;
  if (flags.version) {
    out(VERSION);
    return 0;
  }
  if (flags.help || !command || command === "help") {
    out(HELP);
    return 0;
  }
  let url;
  try {
    url = buildUrl(flags.base || env.CRAYONCAT_BASE_URL || DEFAULT_BASE, command, positional, flags);
  } catch (e) {
    err(e.message);
    return 2;
  }
  let res;
  try {
    res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": `crayoncat-cli/${VERSION}` } });
  } catch (e) {
    err(`连接失败：${e.message}`);
    return 1;
  }
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.ok) {
    if (flags.json && body) out(JSON.stringify(body, null, 2));
    else err(body?.message ?? `请求失败（HTTP ${res.status}）`);
    return res.status === 404 ? 4 : 1;
  }
  out(flags.json ? JSON.stringify(body, null, 2) : format(command, body));
  return 0;
}
