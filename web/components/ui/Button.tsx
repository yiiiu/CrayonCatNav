import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "default" | "primary" | "danger";
type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function Button({ variant = "default", className, type = "button", ...rest }: Props) {
  const cls = [styles.btn, variant !== "default" && styles[variant], className].filter(Boolean).join(" ");
  return <button type={type} className={cls} {...rest} />;
}
