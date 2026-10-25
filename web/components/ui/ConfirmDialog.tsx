"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore, type ButtonHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";
import styles from "./ConfirmDialog.module.css";

export type ConfirmTone = "danger" | "default";

export type ConfirmOptions = {
  /** 标题，如「删除资源」 */
  title: ReactNode;
  /** 说明文字：后果、影响范围 */
  message?: ReactNode;
  /** 确认按钮文字，默认「确定」 */
  confirmText?: string;
  /** 取消按钮文字，默认「取消」 */
  cancelText?: string;
  /** danger：红色确认按钮，用于删除、拒绝等不可逆操作 */
  tone?: ConfirmTone;
};

const noopSubscribe = () => () => {};

type DialogProps = ConfirmOptions & {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * 二次确认弹窗（受控）。基于原生 <dialog>.showModal()：自带焦点圈定、Esc 关闭、背景不可点。
 * 打开时默认聚焦「取消」，避免误按回车直接执行危险操作。
 */
export function ConfirmDialog({ open, title, message, confirmText = "确定", cancelText = "取消", tone = "danger", onConfirm, onCancel }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  // 客户端为 true、服务端渲染为 false：portal 只在客户端挂载
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      cancelRef.current?.focus();
    } else if (!open && d.open) {
      d.close();
    }
  }, [open, mounted]);

  if (!mounted) return null;

  return createPortal(
    <dialog
      ref={ref}
      className={styles.dialog}
      aria-labelledby={titleId}
      aria-describedby={message ? descId : undefined}
      role="alertdialog"
      onCancel={(e) => {
        e.preventDefault(); // Esc：交给父组件关闭，保持受控
        onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel(); // 点遮罩关闭
      }}
    >
      <div className={styles.panel}>
        <h2 id={titleId} className={styles.title}>{title}</h2>
        {message && <div id={descId} className={styles.message}>{message}</div>}
        <div className={styles.acts}>
          <Button ref={cancelRef} onClick={onCancel}>{cancelText}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

/**
 * 需要二次确认的提交按钮。放在 <form> 里用法和普通 submit 按钮一样，
 * 可带 formAction / name / value；点击先弹确认框，确认后以本按钮为 submitter 提交表单。
 */
export function ConfirmButton({
  title,
  message,
  confirmText,
  cancelText,
  tone,
  onClick,
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title"> & ConfirmOptions) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        type="submit"
        {...rest}
        ref={btn}
        onClick={(e: MouseEvent<HTMLButtonElement>) => {
          onClick?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          setOpen(true);
        }}
      />
      <ConfirmDialog
        open={open}
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        tone={tone}
        onCancel={() => {
          setOpen(false);
          btn.current?.focus();
        }}
        onConfirm={() => {
          setOpen(false);
          const b = btn.current;
          b?.form?.requestSubmit(b); // requestSubmit 不触发 click，不会再次弹窗
        }}
      />
    </>
  );
}
