import { statusLabels } from "@/lib/validation/resource";
import styles from "./admin.module.css";

export function StatusBadge({ status }: { status: keyof typeof statusLabels }) {
  return <span className={`${styles.st} ${styles[`st_${status}`]}`}>{statusLabels[status]}</span>;
}
