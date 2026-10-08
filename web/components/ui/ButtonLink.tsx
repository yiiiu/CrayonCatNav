import Link from "next/link";
import type { ComponentProps } from "react";
import styles from "./Button.module.css";

type Props = ComponentProps<typeof Link> & { variant?: "default" | "primary" };

export function ButtonLink({ variant = "default", className, ...rest }: Props) {
  return <Link className={[styles.btn, variant === "primary" && styles.primary, className].filter(Boolean).join(" ")} {...rest} />;
}

/** 外部链接：仅 https，统一新标签 + noopener noreferrer。 */
export function ExternalButton({ href, children, variant = "default" }: { href: string; children: React.ReactNode; variant?: "default" | "primary" }) {
  if (!href.startsWith("https://")) return null;
  return (
    <a className={[styles.btn, variant === "primary" && styles.primary].filter(Boolean).join(" ")} href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <span aria-hidden="true">↗</span>
      <span className="sr-only">（在新标签页打开）</span>
    </a>
  );
}
