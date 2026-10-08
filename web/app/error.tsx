"use client";

import { useEffect } from "react";
import { Button, ButtonLink, Card } from "@/components/ui";
import styles from "./not-found.module.css";

/** 全局客户端错误边界：手绘风格友好提示与重试机制 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 客户端异常兜底
  }, [error]);

  return (
    <Card className={styles.nf}>
      <div className={styles.big} style={{ fontSize: "clamp(54px, 12vw, 96px)", letterSpacing: "4px" }}>
        哎呀
      </div>
      <p className={styles.msg}>页面遇到了一点小意外，点击重试或返回首页看看</p>
      <div className={styles.acts}>
        <Button variant="primary" onClick={() => reset()}>
          重试一下
        </Button>
        <ButtonLink href="/">返回首页</ButtonLink>
      </div>
    </Card>
  );
}
