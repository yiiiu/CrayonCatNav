import Link from "next/link";
import type { ComponentProps, HTMLAttributes } from "react";
import styles from "./Chip.module.css";

type Look = { active?: boolean; flat?: boolean; cat?: boolean };

const cls = ({ active, flat, cat }: Look, className?: string) =>
  [styles.chip, active && styles.on, flat && styles.flat, cat && styles.cat, className].filter(Boolean).join(" ");

export function Chip({ active, flat, cat, className, ...rest }: HTMLAttributes<HTMLSpanElement> & Look) {
  return <span className={cls({ active, flat, cat }, className)} {...rest} />;
}

export function ChipLink({ active, flat, cat, className, ...rest }: ComponentProps<typeof Link> & Look) {
  return <Link className={cls({ active, flat, cat }, className)} aria-current={active ? "true" : undefined} {...rest} />;
}
