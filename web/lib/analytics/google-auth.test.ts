import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it } from "vitest";
import { GOOGLE_TOKEN_URL, GSC_SCOPE, buildJwtAssertion, readServiceAccount } from "./google-auth";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const email = "crayon-gsc@demo-project.iam.gserviceaccount.com";

describe("服务账号凭据", () => {
  it("读取整份 JSON", () => {
    const sa = readServiceAccount({ GSC_SERVICE_ACCOUNT_JSON: JSON.stringify({ client_email: email, private_key: pem }) });
    expect(sa?.clientEmail).toBe(email);
  });
  it("读取拆分变量，私钥中的字面量 \\n 还原为换行", () => {
    const sa = readServiceAccount({ GSC_CLIENT_EMAIL: email, GSC_PRIVATE_KEY: pem.replace(/\n/g, "\\n") });
    expect(sa?.privateKey).toBe(pem.trim());
  });
  it("缺失或格式错误返回 null", () => {
    expect(readServiceAccount({})).toBeNull();
    expect(readServiceAccount({ GSC_SERVICE_ACCOUNT_JSON: "{bad" })).toBeNull();
    expect(readServiceAccount({ GSC_CLIENT_EMAIL: email, GSC_PRIVATE_KEY: "nope" })).toBeNull();
  });
});

describe("JWT 断言", () => {
  it("RS256 签名可验证，声明正确", () => {
    const now = Date.UTC(2026, 9, 25, 0, 0, 0);
    const jwt = buildJwtAssertion({ clientEmail: email, privateKey: pem }, now);
    const [h, c, s] = jwt.split(".");
    expect(JSON.parse(Buffer.from(h, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toEqual({ iss: email, scope: GSC_SCOPE, aud: GOOGLE_TOKEN_URL, iat: now / 1000, exp: now / 1000 + 3600 });
    expect(verify("RSA-SHA256", Buffer.from(`${h}.${c}`), publicKey, Buffer.from(s, "base64url"))).toBe(true);
  });
});
