import { describe, expect, it } from "vitest";
import { addDays, classifySource, cleanHost, deviceOf, hostOfReferrer, isBotUA, isoDay, normalizePath, statDay } from "./traffic";

const CHROME_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_PHONE = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36";
const ANDROID_TAB = "Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const IPAD = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("normalizePath", () => {
  it("去掉 query / hash、末尾斜杠，统一小写", () => {
    expect(normalizePath("/resources?q=mcp&page=2")).toBe("/resources");
    expect(normalizePath("/tools/mcp-config/#top")).toBe("/tools/mcp-config");
    expect(normalizePath("/Resources/Cursor")).toBe("/resources/cursor");
    expect(normalizePath("//resources//cursor")).toBe("/resources/cursor");
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/?utm_source=x")).toBe("/");
  });
  it("排除后台、接口与静态资源", () => {
    expect(normalizePath("/admin")).toBeNull();
    expect(normalizePath("/admin/resources")).toBeNull();
    expect(normalizePath("/api/track")).toBeNull();
    expect(normalizePath("/_next/static/x.js")).toBeNull();
  });
  it("拒绝非页面形态的路径（防刷爆聚合表）", () => {
    expect(normalizePath("resources")).toBeNull();
    expect(normalizePath("/a/b/c")).toBeNull();
    expect(normalizePath("/favicon.ico")).toBeNull();
    expect(normalizePath("/%E4%B8%AD")).toBeNull();
    expect(normalizePath(`/${"a".repeat(65)}`)).toBeNull();
    expect(normalizePath(123)).toBeNull();
  });
  it("不误伤以 admin 开头的普通路径", () => {
    expect(normalizePath("/administrator-tools")).toBe("/administrator-tools");
  });
});

describe("来源分类", () => {
  const self = "crayon-cat-nav.vercel.app";
  it("空来源为直接访问", () => expect(classifySource("", self)).toEqual({ source: "direct", refDomain: "" }));
  it("同站为站内跳转", () => {
    expect(classifySource("crayon-cat-nav.vercel.app", self).source).toBe("internal");
    expect(classifySource("www.crayon-cat-nav.vercel.app", self).source).toBe("internal");
  });
  it("Google 各国域名", () => {
    for (const h of ["www.google.com", "google.com.hk", "www.google.co.jp"]) expect(classifySource(h, self)).toEqual({ source: "google", refDomain: "" });
  });
  it("Bing（含 cn.bing.com）", () => {
    expect(classifySource("www.bing.com", self).source).toBe("bing");
    expect(classifySource("cn.bing.com", self).source).toBe("bing");
  });
  it("其他搜索引擎保留域名", () => {
    expect(classifySource("www.baidu.com", self)).toEqual({ source: "other_search", refDomain: "baidu.com" });
    expect(classifySource("duckduckgo.com", self).source).toBe("other_search");
  });
  it("社交平台", () => {
    expect(classifySource("t.co", self)).toEqual({ source: "social", refDomain: "t.co" });
    expect(classifySource("www.zhihu.com", self)).toEqual({ source: "social", refDomain: "zhihu.com" });
    expect(classifySource("m.facebook.com", self).source).toBe("social");
  });
  it("其余为外链，只存域名", () => {
    expect(classifySource("blog.example.com", self)).toEqual({ source: "referral", refDomain: "blog.example.com" });
  });
  it("仿冒域名不算 Google", () => {
    expect(classifySource("google.evil-site.com", self).source).toBe("referral");
    expect(classifySource("notbing.com", self).source).toBe("referral");
  });
  it("非法主机名当作直接访问", () => {
    expect(classifySource("javascript:alert(1)", self).source).toBe("direct");
    expect(cleanHost("https://x.com/a")).toBe("");
  });
  it("hostOfReferrer 只取主机名", () => {
    expect(hostOfReferrer("https://www.google.com/search?q=secret")).toBe("www.google.com");
    expect(hostOfReferrer("android-app://com.google.android.gm/")).toBe("");
    expect(hostOfReferrer("not a url")).toBe("");
  });
});

describe("设备与机器人", () => {
  it("设备粗分", () => {
    expect(deviceOf(CHROME_MAC)).toBe("desktop");
    expect(deviceOf(IPHONE)).toBe("mobile");
    expect(deviceOf(ANDROID_PHONE)).toBe("mobile");
    expect(deviceOf(ANDROID_TAB)).toBe("tablet");
    expect(deviceOf(IPAD)).toBe("tablet");
    expect(deviceOf("")).toBe("desktop");
  });
  it("识别机器人与脚本", () => {
    expect(isBotUA("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(true);
    expect(isBotUA("Mozilla/5.0 (compatible; bingbot/2.0)")).toBe(true);
    expect(isBotUA("curl/8.4.0")).toBe(true);
    expect(isBotUA("Mozilla/5.0 HeadlessChrome/130.0")).toBe(true);
    expect(isBotUA("")).toBe(true);
    expect(isBotUA(null)).toBe(true);
    expect(isBotUA(CHROME_MAC)).toBe(false);
    expect(isBotUA(IPHONE)).toBe(false);
  });
});

describe("统计日（北京时间）", () => {
  it("UTC 16:30 已是北京次日", () => {
    expect(isoDay(statDay(new Date("2026-10-24T16:30:00Z")))).toBe("2026-10-25");
    expect(isoDay(statDay(new Date("2026-10-24T15:59:59Z")))).toBe("2026-10-24");
  });
  it("addDays 跨月", () => expect(isoDay(addDays(new Date("2026-10-31T00:00:00Z"), 1))).toBe("2026-11-01"));
});
