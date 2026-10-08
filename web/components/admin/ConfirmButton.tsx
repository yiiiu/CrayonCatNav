"use client";

import type { ButtonHTMLAttributes } from "react";

/** 提交前弹确认框的按钮，用于删除、下架等不可逆或影响前台的操作。 */
export function ConfirmButton({ message, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { message: string }) {
  return (
    <button
      type="submit"
      {...rest}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    />
  );
}
