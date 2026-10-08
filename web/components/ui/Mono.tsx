import { accentFor, monogram } from "@/lib/ui/accent";
import styles from "./Mono.module.css";

type Props = { name: string; accentKey?: string; size?: "md" | "lg"; label?: string };

/** 蜡笔色块头像：资源没有图标时的统一占位。 */
export function Mono({ name, accentKey, size = "md", label }: Props) {
  return (
    <span
      className={`${styles.mono} ${size === "lg" ? styles.lg : ""}`}
      style={{ ["--accent" as string]: accentFor(accentKey ?? name) }}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    >
      {label ?? monogram(name)}
    </span>
  );
}
