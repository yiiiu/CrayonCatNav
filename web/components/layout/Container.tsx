import type { ReactNode } from "react";

export function Container({ children }: { children: ReactNode }) {
  return <div style={{ maxWidth: "var(--container)", margin: "0 auto", padding: "var(--sp-6) var(--sp-6) var(--sp-12)" }}>{children}</div>;
}
