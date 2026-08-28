import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "@/components/providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: "CompetitionOS",
  description: "Configurable competition management platform",
  manifest: "/manifest.json",
  icons: [
    { rel: "icon", url: "/logo.jpg" },
    { rel: "apple-touch-icon", url: "/logo.jpg" },
  ],
  viewport: "width=device-width, initial-scale=1",
  other: {
    "theme-color": "#E8A623",
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
    <html lang="en" className={`${dmSans.variable} h-full`}>
      <body className="min-h-full">
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
