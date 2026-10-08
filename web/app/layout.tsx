import type { Metadata } from "next";
import { WobbleDefs } from "@/components/ui";
import { siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s｜${siteConfig.name}` },
  description: siteConfig.description,
  icons: { icon: "/cat-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <WobbleDefs />
        {children}
      </body>
    </html>
  );
}
