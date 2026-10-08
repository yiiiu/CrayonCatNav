import type { ReactNode } from "react";
import styles from "./admin.module.css";

type Props = { label: string; name: string; error?: string; hint?: ReactNode; wide?: boolean; children: ReactNode };

/** 表单字段外壳：label + 控件 + 提示/错误（aria-describedby 由调用方的控件 id 关联）。 */
export function Field({ label, name, error, hint, wide, children }: Props) {
  return (
    <div className={[styles.field, error && styles.bad, wide && styles.wide].filter(Boolean).join(" ")}>
      <label htmlFor={`f-${name}`}>{label}</label>
      {children}
      {hint && !error ? <span className={styles.hint}>{hint}</span> : null}
      {error ? (
        <p className={styles.err} id={`f-${name}-err`} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
