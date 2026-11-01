"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/domain/result";
import { ConfirmButton, Select } from "@/components/ui";
import styles from "./admin.module.css";

type Props = {
  tags: { id: string; name: string; slug: string; usage: number }[];
  merge: (prev: ActionResult, fd: FormData) => Promise<ActionResult>;
};

/** 合并重复标签：来源的资源转到目标，来源名称变成目标的别名，然后删除来源。 */
export function TagMerge({ tags, merge }: Props) {
  const [state, action, pending] = useActionState(merge, { ok: true } as ActionResult);
  const options = tags.map((t) => ({ value: t.id, label: t.name, hint: `${t.slug} · ${t.usage} 个` }));
  return (
    <form action={action} className={styles.mergeRow}>
      <Select name="source" options={options} placeholder="要合并掉的标签" aria-label="要合并掉的标签" required />
      <span aria-hidden="true">→</span>
      <Select name="target" options={options} placeholder="保留的标签" aria-label="保留的标签" required />
      <ConfirmButton
        className={styles.linkBtn}
        disabled={pending}
        title="合并标签"
        message="确定合并？前一个标签的资源会转到后一个标签，它的名称会变成后一个标签的别名，然后被删除。"
        confirmText="合并"
      >
        合并
      </ConfirmButton>
      {state.ok && state.message && <p className={styles.hint} role="status">{state.message}</p>}
      {!state.ok && <p className={styles.err} role="alert">{state.formError}</p>}
    </form>
  );
}
