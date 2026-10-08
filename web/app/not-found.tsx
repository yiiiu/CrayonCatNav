import { ButtonLink, Card } from "@/components/ui";
import styles from "./not-found.module.css";

/** 404 页面：手绘蜡笔风艺术字与返回引导，取自 prototypes/前台.html */
export default function NotFound() {
  return (
    <Card className={styles.nf}>
      <div className={styles.big}>404</div>
      <p className={styles.msg}>这个页面或资源不存在，或者已被小猫下架了</p>
      <div className={styles.acts}>
        <ButtonLink href="/" variant="primary">
          返回首页
        </ButtonLink>
        <ButtonLink href="/resources">去发现资源</ButtonLink>
      </div>
    </Card>
  );
}
