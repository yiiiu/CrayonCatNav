import type { ReactNode } from "react";
import styles from "./admin.module.css";

export function AdminTop({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className={styles.top}>
      <h1>{title}</h1>
      {children}
    </header>
  );
}
