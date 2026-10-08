import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <Container>
      <EmptyState title="这页被小猫藏起来了">
        <Link href="/">回到首页</Link>
      </EmptyState>
    </Container>
  );
}
