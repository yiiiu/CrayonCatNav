import { sign } from "node:crypto";

/** Google 服务账号凭据解析与 JWT 断言（RFC 7523 jwt-bearer），只在服务端使用。 */

export const GSC_SCOPE = "https://www.googleapis.com/auth/webmasters.readonly";
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

export type ServiceAccount = { clientEmail: string; privateKey: string };

type Env = Record<string, string | undefined>;

/**
 * 读取凭据：优先 GSC_SERVICE_ACCOUNT_JSON（整份 JSON 密钥文件内容），
 * 否则 GSC_CLIENT_EMAIL + GSC_PRIVATE_KEY（私钥里的 \n 可写成字面量 \\n）。
 * 缺失或格式不对返回 null。
 */
export function readServiceAccount(env: Env): ServiceAccount | null {
  const json = env.GSC_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    try {
      const o = JSON.parse(json) as { client_email?: unknown; private_key?: unknown };
      if (typeof o.client_email === "string" && typeof o.private_key === "string") {
        return normalize(o.client_email, o.private_key);
      }
    } catch {
      /* 落到下一种配置方式 */
    }
  }
  const email = env.GSC_CLIENT_EMAIL?.trim();
  const key = env.GSC_PRIVATE_KEY;
  if (email && key) return normalize(email, key);
  return null;
}

function normalize(clientEmail: string, privateKey: string): ServiceAccount | null {
  const key = privateKey.replace(/\\n/g, "\n").trim();
  if (!clientEmail.includes("@") || !key.includes("PRIVATE KEY")) return null;
  return { clientEmail: clientEmail.trim(), privateKey: key };
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString("base64url");

/** 生成发往 token 端点的签名 JWT（RS256，有效期 1 小时）。 */
export function buildJwtAssertion(sa: ServiceAccount, nowMs: number = Date.now(), scope: string = GSC_SCOPE): string {
  const iat = Math.floor(nowMs / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: sa.clientEmail, scope, aud: GOOGLE_TOKEN_URL, iat, exp: iat + 3600 }));
  const data = `${header}.${claims}`;
  const sig = sign("RSA-SHA256", Buffer.from(data), sa.privateKey);
  return `${data}.${b64url(sig)}`;
}
