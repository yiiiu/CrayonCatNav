"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./SiteHeader.module.css";

/** 蜡笔风手绘涂鸦波浪下划线：取自 prototypes/前台.html */
function Scribble() {
  return (
    <svg
      className={styles.scribble}
      viewBox="0 0 120 12"
      preserveAspectRatio="none"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M3 7c18-4 36-3 54-1s40 1 60-3" />
      <path d="M8 10c22-3 46-2 70-1 12 0 22-1 32-3" strokeWidth="2" opacity=".6" />
    </svg>
  );
}

export function SiteHeader() {
  const pathname = usePathname();

  const isDiscover = pathname === "/" || pathname.startsWith("/resources");
  const isTools = pathname.startsWith("/tools");

  return (
    <header className={styles.top}>
      <Link href="/" className={styles.brand}>
        <Image className={styles.logo} src="/cat-logo.png" alt="蜡笔猫标志：拿着咖啡杯的蓝色小猫" width={48} height={48} priority />
        <b className={styles.name}>蜡笔猫导航</b>
      </Link>
      <nav className={styles.nav} aria-label="主导航">
        <Link
          href="/resources"
          className={`${styles.navLink} ${isDiscover ? styles.on : ""}`}
          aria-current={isDiscover ? "page" : undefined}
        >
          发现
          <Scribble />
        </Link>
        <Link
          href="/tools"
          className={`${styles.navLink} ${isTools ? styles.on : ""}`}
          aria-current={isTools ? "page" : undefined}
        >
          工具箱
          <Scribble />
        </Link>
      </nav>
    </header>
  );
}
