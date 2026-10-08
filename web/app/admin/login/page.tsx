import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Card } from "@/components/ui";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "管理员登录", robots: { index: false } };

export default function AdminLoginPage() {
  return (
    <Container>
      <Card style={{ maxWidth: 420, margin: "var(--sp-12) auto" }}>
        <h1 style={{ marginTop: 0 }}>管理员登录</h1>
        <LoginForm />
      </Card>
    </Container>
  );
}
