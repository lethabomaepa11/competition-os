import type { Metadata, Viewport } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "CompetitionOS — Run every competition", template: "%s | CompetitionOS" },
  description: "The competition command center for leagues, federations, tournament operators, and esports.",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/competitionos-mark.svg", type: "image/svg+xml" },
    { rel: "icon", url: "/icon-192.png", type: "image/png", sizes: "192x192" },
    { rel: "apple-touch-icon", url: "/apple-touch-icon.png", sizes: "180x180" },
  ],
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "CompOS",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#07111F",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AntdRegistry>
          <Providers>{children}</Providers>
        </AntdRegistry>
        <Analytics />
        <Script
          id="register-sw"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ("serviceWorker" in navigator) {
                window.addEventListener("load", () => {
                  navigator.serviceWorker.register("/sw.js");
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
