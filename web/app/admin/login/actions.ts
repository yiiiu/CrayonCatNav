"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth/auth";

export type LoginState = { error?: string };

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/admin/resources",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) return { error: "邮箱或密码不正确，或尝试过于频繁，请稍后再试。" };
    throw err; // 让 Next.js 处理 redirect
  }
}
