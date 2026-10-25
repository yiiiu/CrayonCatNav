import { describe, expect, it } from "vitest";
import { decryptSecret, deriveKey, encryptSecret, keySource, last4 } from "./crypto";

describe("密钥加解密", () => {
  const key = deriveKey("test-secret");

  it("加密后能原样解密，且每次密文不同", () => {
    const a = encryptSecret("sk-abcdef123456", key);
    const b = encryptSecret("sk-abcdef123456", key);
    expect(a.startsWith("v1:")).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toContain("abcdef");
    expect(decryptSecret(a, key)).toBe("sk-abcdef123456");
    expect(decryptSecret(encryptSecret("含中文的密钥🔑", key), key)).toBe("含中文的密钥🔑");
  });

  it("换了密钥或密文被篡改时返回 null", () => {
    const enc = encryptSecret("secret-value", key);
    expect(decryptSecret(enc, deriveKey("other-secret"))).toBeNull();
    const buf = Buffer.from(enc.slice(3), "base64");
    buf[buf.length - 1] ^= 1;
    expect(decryptSecret(`v1:${buf.toString("base64")}`, key)).toBeNull();
    expect(decryptSecret("garbage", key)).toBeNull();
    expect(decryptSecret(null, key)).toBeNull();
    expect(decryptSecret("v1:AAAA", key)).toBeNull();
  });

  it("派生密钥为 32 字节且稳定", () => {
    expect(deriveKey("x")).toHaveLength(32);
    expect(deriveKey("x").equals(deriveKey("x"))).toBe(true);
    expect(deriveKey("x").equals(deriveKey("y"))).toBe(false);
  });

  it("优先 AGENT_ENCRYPTION_KEY，否则回退 AUTH_SECRET", () => {
    expect(keySource({ AGENT_ENCRYPTION_KEY: "k", AUTH_SECRET: "a" })).toBe("AGENT_ENCRYPTION_KEY");
    expect(keySource({ AGENT_ENCRYPTION_KEY: "  ", AUTH_SECRET: "a" })).toBe("AUTH_SECRET");
    expect(keySource({})).toBeNull();
  });

  it("末四位：短密钥不暴露", () => {
    expect(last4("sk-1234567890abcd")).toBe("abcd");
    expect(last4("short")).toBe("****");
  });
});
