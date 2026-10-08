import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Card } from "@/components/ui";

export default function HomePage() {
  return (
    <Container>
      <SiteHeader />
      <Card style={{ marginTop: "var(--sp-8)" }}>
        <h1 style={{ margin: 0 }}>蜡笔猫导航</h1>
        <p>AI 资源导航 + 在线工具箱，建设中。</p>
      </Card>
    </Container>
  );
}
