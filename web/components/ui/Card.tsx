import type { HTMLAttributes } from "react";
import styles from "./Card.module.css";

type Props = HTMLAttributes<HTMLDivElement> & { interactive?: boolean };

export function Card({ interactive, className, ...rest }: Props) {
  const cls = [styles.card, interactive && styles.interactive, className].filter(Boolean).join(" ");
  return <div className={cls} {...rest} />;
}
