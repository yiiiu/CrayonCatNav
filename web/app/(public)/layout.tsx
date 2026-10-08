import { Container } from "@/components/layout/Container";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <SiteHeader />
      <main style={{ marginTop: "var(--sp-8)" }}>{children}</main>
    </Container>
  );
}
