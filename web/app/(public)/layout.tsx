import { Container } from "@/components/layout/Container";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Container>
      <SiteHeader />
      <main style={{ marginTop: "var(--sp-6)" }}>{children}</main>
      <SiteFooter />
    </Container>
  );
}
