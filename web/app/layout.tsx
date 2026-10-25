import type { Metadata } from "next";
import { WobbleDefs } from "@/components/ui";
import { siteConfig } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: { default: siteConfig.name, template: `%s｜${siteConfig.name}` },
  description: siteConfig.description,
  icons: { icon: "/cat-logo.png" },
  verification: siteVerification(),
};

/** 站长平台验证 meta：Google（google-site-verification）与 Bing（msvalidate.01），未配置则不输出。 */
function siteVerification(): Metadata["verification"] {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();
  if (!google && !bing) return undefined;
  return { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) };
}

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
