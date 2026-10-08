import type { NextAuthConfig } from "next-auth";

/** 不依赖数据库的 Auth.js 基础配置，供 proxy.ts 轻量复用。 */
export const authConfig = {
  pages: { signIn: "/admin/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.adminId = user.id;
      return token;
    },
    session({ session, token }) {
      if (typeof token.adminId === "string") session.user.id = token.adminId;
      return session;
    },
  },
} satisfies NextAuthConfig;
