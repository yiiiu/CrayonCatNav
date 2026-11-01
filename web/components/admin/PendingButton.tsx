"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import a from "./agent.module.css";

type Props = Omit<React.ComponentProps<typeof Button>, "children"> & {
  label: React.ReactNode;
  pendingLabel: React.ReactNode;
  /** 表单里有多个提交按钮时，只在本按钮的 formAction 提交时显示等待 */
  formAction?: (fd: FormData) => void | Promise<void>;
};

/** 提交中显示转圈与等待文字的按钮（用在 <form> 里）。 */
export function PendingButton({ label, pendingLabel, formAction, disabled, ...rest }: Props) {
  const status = useFormStatus();
  const mine = status.pending && (!formAction || status.action === formAction);
  return (
    <Button type="submit" formAction={formAction} disabled={disabled || status.pending} aria-busy={mine || undefined} {...rest}>
      {mine ? (
        <>
          <span className={a.spin} aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        label
      )}
    </Button>
  );
}
