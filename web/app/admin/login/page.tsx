import type { Metadata } from "next";
import Image from "next/image";
import { Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";
import styles from "./login.module.css";

export const metadata: Metadata = { title: "管理员登录", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <div className={styles.center}>
      <Card className={styles.loginCard} aria-label="管理员登录">
        <Image
          className={styles.bigLogo}
          src="/cat-logo.png"
          alt="蜡笔猫标志：拿着咖啡杯的蓝色小猫"
          width={104}
          height={104}
          priority
        />
        <h1 className={styles.h1}>管理员登录</h1>
        <p className={styles.note}>
          蜡笔猫导航 · 后台 <span className={styles.slug}>/admin/login</span>
        </p>
        <LoginForm />
        <p className={styles.small}>仅限管理员 · 不开放注册</p>
      </Card>
    </div>
  );
}

