"use client";

import { ConfigProvider } from "antd";
import { antdTheme } from "@/lib/theme";
import { CompetitionLogo } from "@/components/common/competition-logo";
import { RouteProgress } from "@/components/common/route-progress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider theme={antdTheme} spin={{ indicator: <CompetitionLogo size={46} animated /> }}>
      <RouteProgress />
      {children}
    </ConfigProvider>
  );
}
