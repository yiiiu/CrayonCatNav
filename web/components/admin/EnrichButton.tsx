"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/domain/result";
import styles from "./admin.module.css";

type Action0 = (prev: ActionResult) => Promise<ActionResult>;

/** AI 补全按钮：单条（编辑页）与批量（采集 Agent 页）共用。 */
export function EnrichButton({ action, label, pendingLabel, className }: { action: Action0; label: string; pendingLabel: string; className?: string }) {
  const [state, formAction, pending] = useActionState(action, { ok: true } as ActionResult);
  return (
    <form action={formAction} className={styles.enrich}>
      <button type="submit" className={className ?? styles.enrichBtn} disabled={pending}>
        {pending ? pendingLabel : label}
      </button>
      {!state.ok && state.formError && <p className={styles.alert} role="alert">{state.formError}</p>}
      {state.ok && state.message && <p className={styles.ok} role="status">{state.message}</p>}
    </form>
  );
}
