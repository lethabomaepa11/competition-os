"use client";

import { Spin, Typography } from "antd";

export function PageLoader({ label = "Loading workspace", className }: { label?: string; className?: string }) {
  return (
    <div className={className ?? "page-loading"} aria-busy="true" aria-live="polite">
      <Spin size="large" />
      <Typography.Text type="secondary" style={{ display: "block", marginTop: 18 }}>{label}</Typography.Text>
    </div>
  );
}
