"use client";

import { ConfigProvider } from "antd";
import { themeConfig } from "@/lib/theme";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={themeConfig}>
      {children}
    </ConfigProvider>
  );
}
