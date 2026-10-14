import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Browser tests use an isolated cache so they can run beside a developer preview.
  distDir: process.env.E2E_TEST_MODE === "1" ? ".next-e2e" : ".next",
};

export default nextConfig;
