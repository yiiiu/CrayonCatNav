"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} style={{ display: "grid", gap: "var(--sp-4)" }}>
      <label>
        邮箱
        <input name="email" type="email" autoComplete="username" required />
      </label>
      <label>
        密码
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p role="alert" style={{ color: "var(--err)", margin: 0 }}>{state.error}</p> : null}
      <Button type="submit" variant="primary" disabled={pending}>
        {pending ? "登录中…" : "登录后台"}
      </Button>
    </form>
  );
}
