import Link from "next/link";

export function SiteFooter() {
  return (
    <footer style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 54, fontSize: "var(--fs-sm)", fontWeight: 700 }}>
      <span>
        © 2026 蜡笔猫导航 · <Link href="/resources" style={{ textDecoration: "underline" }}>全部资源</Link> ·{" "}
        <Link href="/tools" style={{ textDecoration: "underline" }}>工具箱</Link>
      </span>
    </footer>
  );
}
