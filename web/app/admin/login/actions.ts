"use server";

import { AuthError } from "next-auth";
import { LoginRateLimited, signIn } from "@/lib/auth/auth";
import { retryText } from "@/lib/security/rate-limit-core";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = formData.get("email");
  const password = formData.get("password");

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return { error: "请输入有效的管理员邮箱（例如 admin@example.com）" };
  }
  if (!password || typeof password !== "string" || password.length === 0) {
    return { error: "请输入管理员密码" };
  }

  try {
    await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirectTo: "/admin/overview",
    });
    return {};
  } catch (err) {
    if (err instanceof LoginRateLimited) return { error: `尝试过于频繁，请 ${retryText(err.retryAfterSec)}后再试。` };
    if (err instanceof AuthError) return { error: "邮箱或密码不正确。" };
    throw err; // 让 Next.js 处理 redirect
  }
}
