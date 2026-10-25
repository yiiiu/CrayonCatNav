import { describe, expect, it } from "vitest";
import { canonicalGithubUrl, githubRepoOf, isHttpsUrl, normalizeUrl, urlKeysOf } from "./url";

describe("normalizeUrl", () => {
  it("小写 host、去 www、去尾斜杠与 hash", () => {
    expect(normalizeUrl("https://WWW.Example.COM/Docs/#intro")).toBe("example.com/Docs");
    expect(normalizeUrl("https://example.com/")).toBe("example.com");
    expect(normalizeUrl("http://example.com")).toBe("example.com");
  });
  it("去掉追踪参数，其余参数按键排序", () => {
    expect(normalizeUrl("https://example.com/p?utm_source=x&b=2&ref=hn&a=1&fbclid=1")).toBe("example.com/p?a=1&b=2");
    expect(normalizeUrl("https://example.com/?utm_medium=social")).toBe("example.com");
  });
  it("去默认端口，保留非默认端口；index.html 视为根", () => {
    expect(normalizeUrl("https://example.com:443/a/")).toBe("example.com/a");
    expect(normalizeUrl("https://example.com:8443/a")).toBe("example.com:8443/a");
    expect(normalizeUrl("https://example.com/index.html")).toBe("example.com");
  });
  it("GitHub 统一为 github.com/owner/repo（小写）", () => {
    expect(normalizeUrl("https://github.com/Owner/Repo")).toBe("github.com/owner/repo");
    expect(normalizeUrl("https://www.github.com/owner/repo.git")).toBe("github.com/owner/repo");
    expect(normalizeUrl("https://github.com/owner/repo/tree/main/packages/x?tab=readme")).toBe("github.com/owner/repo");
    expect(normalizeUrl("github.com/owner/repo/")).toBe("github.com/owner/repo");
  });
  it("GitHub 非仓库页按普通链接处理", () => {
    expect(normalizeUrl("https://github.com/topics/mcp")).toBe("github.com/topics/mcp");
    expect(normalizeUrl("https://github.com/owner")).toBe("github.com/owner");
  });
  it("非法或非 http(s) 返回 null", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("ftp://example.com/x")).toBeNull();
  });
});

describe("githubRepoOf / canonicalGithubUrl", () => {
  it("取 owner/repo，保留原大小写的规范链接", () => {
    expect(githubRepoOf("https://github.com/punkpeye/awesome-mcp-servers#readme")).toBe("punkpeye/awesome-mcp-servers");
    expect(canonicalGithubUrl("https://github.com/n8n-io/n8n/issues/1")).toBe("https://github.com/n8n-io/n8n");
    expect(canonicalGithubUrl("http://www.github.com/A/B.git")).toBe("https://github.com/A/B");
  });
  it("保留路径与非 GitHub 域名不算仓库", () => {
    expect(githubRepoOf("https://github.com/orgs/foo")).toBeNull();
    expect(githubRepoOf("https://gitlab.com/a/b")).toBeNull();
    expect(githubRepoOf("https://github.com/a/..")).toBeNull();
  });
});

describe("urlKeysOf / isHttpsUrl", () => {
  it("合并多个链接的键并去重", () => {
    expect(urlKeysOf("https://github.com/a/b", "https://www.github.com/A/B/", null, "https://b.dev/")).toEqual(["github.com/a/b", "b.dev"]);
  });
  it("仅 https 视为合法外链", () => {
    expect(isHttpsUrl("https://a.com")).toBe(true);
    expect(isHttpsUrl("http://a.com")).toBe(false);
    expect(isHttpsUrl(null)).toBe(false);
    expect(isHttpsUrl("not a url")).toBe(false);
  });
});
