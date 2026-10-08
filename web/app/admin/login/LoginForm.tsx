"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui";
import { loginAction, type LoginState } from "./actions";
import styles from "./login.module.css";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className={styles.form}>
      {state.error ? (
        <div className={styles.alert} role="alert">
          <span>⚠️</span>
          <span>{state.error}</span>
        </div>
      ) : null}
      <label className={`${styles.field} ${state.error ? styles.fieldBad : ""}`}>
        <span>邮箱</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          placeholder="admin@example.com"
          required
        />
      </label>
      <label className={`${styles.field} ${state.error ? styles.fieldBad : ""}`}>
        <span>密码</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="请输入管理员密码"
          required
        />
      </label>
      <Button type="submit" variant="primary" disabled={pending} className={styles.submitBtn}>
        {pending ? "登录中…" : "登录后台"}
      </Button>
    </form>
  );
}

