import { describe, expect, it } from "vitest";
import { checkFetchableUrl, isBlockedAddress, isBlockedHostname } from "./ssrf";

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "127.10.0.5",
    "10.0.0.1",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "255.255.255.255",
    "198.18.0.1",
  ])("拒绝 IPv4 %s", (ip) => expect(isBlockedAddress(ip)).toBe(true));

  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "140.82.112.3", "104.16.0.1"])("放行公网 IPv4 %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));

  it.each(["::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "::ffff:10.0.0.1", "64:ff9b::a9fe:a9fe", "2002:c0a8:0101::1", "[::1]", "2001:db8::1"])(
    "拒绝 IPv6 %s",
    (ip) => expect(isBlockedAddress(ip)).toBe(true),
  );

  it.each(["2606:4700:4700::1111", "2001:4860:4860::8888", "::ffff:8.8.8.8"])("放行公网 IPv6 %s", (ip) => expect(isBlockedAddress(ip)).toBe(false));

  it("不是 IP 一律拒绝", () => {
    expect(isBlockedAddress("example.com")).toBe(true);
    expect(isBlockedAddress("999.1.1.1")).toBe(true);
  });
});

describe("isBlockedHostname / checkFetchableUrl", () => {
  it("内网主机名直接拒绝", () => {
    for (const h of ["localhost", "a.localhost", "printer.local", "db.internal", "intranet", "router.lan"]) expect(isBlockedHostname(h)).toBe(true);
    expect(isBlockedHostname("github.com")).toBe(false);
  });
  it("只允许 http/https，拒绝账号密码与内网 IP 字面量", () => {
    expect(checkFetchableUrl("https://example.com/a").ok).toBe(true);
    expect(checkFetchableUrl("http://example.com").ok).toBe(true);
    expect(checkFetchableUrl("file:///etc/passwd").ok).toBe(false);
    expect(checkFetchableUrl("gopher://example.com").ok).toBe(false);
    expect(checkFetchableUrl("https://user:pw@example.com").ok).toBe(false);
    expect(checkFetchableUrl("http://127.0.0.1:5433").ok).toBe(false);
    expect(checkFetchableUrl("http://[::1]/").ok).toBe(false);
    expect(checkFetchableUrl("http://169.254.169.254/latest/meta-data").ok).toBe(false);
    expect(checkFetchableUrl("not a url").ok).toBe(false);
  });
  it("十进制 / 十六进制 IP 写法会被 URL 解析成点分形式后拒绝", () => {
    expect(checkFetchableUrl("http://2130706433/").ok).toBe(false);
    expect(checkFetchableUrl("http://0x7f.0.0.1/").ok).toBe(false);
  });
});
