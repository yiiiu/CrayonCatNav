import "server-only";
import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import { prisma } from "@/lib/data/prisma";
import { authConfig } from "./auth.config";
import { clientIp } from "@/lib/analytics/visitor";
import { hitAll, LOGIN_EMAIL, LOGIN_EMAIL_IP, LOGIN_IP, reset, UNKNOWN_IP } from "@/lib/security/rate-limit";

/** 登录尝试过于频繁：登录 action 据此提示等待时间（code 会出现在 Auth.js 的错误跳转参数里）。 */
export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
  constructor(readonly retryAfterSec: number) {
    super();
  }
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: { label: "邮箱" }, password: { label: "密码", type: "password" } },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        // 先限流再查库与 bcrypt（规格 docs/spec/限流改数据库方案.md §4）。
        // server action 里的 signIn 会把真实请求头复制进 request，直接 POST 回调接口时就是原请求。
        const ip = clientIp(request.headers) || UNKNOWN_IP;
        const emailIp = `${email}|${ip}`;
        const limit = await hitAll([
          [LOGIN_IP, ip],
          [LOGIN_EMAIL_IP, emailIp],
          [LOGIN_EMAIL, email],
        ]);
        if (!limit.ok) throw new LoginRateLimited(limit.retryAfterSec);
        const admin = await prisma.admin.findUnique({ where: { email } });
        if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) return null;
        await reset(LOGIN_EMAIL_IP, emailIp);
        return { id: admin.id, email: admin.email };
      },
    }),
  ],
});
