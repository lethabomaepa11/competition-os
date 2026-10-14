import type { Metadata } from "next";
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
    { rel: "icon", url: "/icon-192.png" },
    { rel: "apple-touch-icon", url: "/icon-192.png" },
  ],
  viewport: "width=device-width, initial-scale=1",
  other: {
    "theme-color": "#07111F",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "CompOS",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
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
