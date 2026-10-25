/**
 * 采集 Agent 密钥的加解密：AES-256-GCM，格式 `v1:` + base64(iv[12] | tag[16] | 密文)。
 * 密钥：优先用环境变量 AGENT_ENCRYPTION_KEY；未设置时由 AUTH_SECRET 经 HKDF-SHA256 派生
 * （此时更换 AUTH_SECRET 会让已存密钥无法解密，需在后台重新填写）。
 */
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

const SALT = "crayon-cat-nav/agent";
const INFO = "agent-secret-v1";

export type KeySource = "AGENT_ENCRYPTION_KEY" | "AUTH_SECRET";

/** 当前密钥来源；两者都没有返回 null。 */
export function keySource(env: Record<string, string | undefined> = process.env): KeySource | null {
  if (env.AGENT_ENCRYPTION_KEY?.trim()) return "AGENT_ENCRYPTION_KEY";
  if (env.AUTH_SECRET?.trim()) return "AUTH_SECRET";
  return null;
}

/** 由任意长度的秘密串派生 32 字节密钥（两种来源都走 HKDF，接受任意格式的字符串）。 */
export function deriveKey(secret: string): Buffer {
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret, "utf8"), SALT, INFO, 32));
}

function envKey(env: Record<string, string | undefined> = process.env): Buffer {
  const src = keySource(env);
  if (!src) throw new Error("未配置 AGENT_ENCRYPTION_KEY 或 AUTH_SECRET，无法加密保存密钥");
  return deriveKey(env[src]!.trim());
}

export function encryptSecret(plain: string, key: Buffer = envKey()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64")}`;
}

/** 解密失败（密钥已变更或数据损坏）返回 null，不抛错。 */
export function decryptSecret(payload: string | null | undefined, key?: Buffer): string | null {
  if (!payload?.startsWith("v1:")) return null;
  try {
    const buf = Buffer.from(payload.slice(3), "base64");
    if (buf.length < 29) return null;
    const decipher = createDecipheriv("aes-256-gcm", key ?? envKey(), buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** 展示用的末四位（不足四位时全部用 * 遮住）。 */
export function last4(secret: string): string {
  const s = secret.trim();
  return s.length > 8 ? s.slice(-4) : "****";
}
