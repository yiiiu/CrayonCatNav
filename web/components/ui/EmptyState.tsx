import type { ReactNode } from "react";
import { Card } from "./Card";

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <Card role="status" style={{ textAlign: "center", padding: "var(--sp-12) var(--sp-6)" }}>
      <h2 style={{ margin: 0, fontSize: "var(--fs-xl)" }}>{title}</h2>
      {children ? <div style={{ marginTop: "var(--sp-3)", color: "var(--ink-2)" }}>{children}</div> : null}
    </Card>
  );
}
