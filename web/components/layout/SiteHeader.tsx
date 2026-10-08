import Image from "next/image";
import Link from "next/link";
import styles from "./SiteHeader.module.css";

export function SiteHeader() {
  return (
    <header className={styles.top}>
      <Link href="/" className={styles.brand}>
        <Image className={styles.logo} src="/cat-logo.png" alt="蜡笔猫标志：拿着咖啡杯的蓝色小猫" width={48} height={48} priority />
        <b className={styles.name}>蜡笔猫导航</b>
      </Link>
      <nav className={styles.nav} aria-label="主导航">
        <Link href="/resources">发现</Link>
        <Link href="/tools">工具箱</Link>
      </nav>
    </header>
  );
}
