"use client";

import { useRouter } from "next/navigation";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

export function BackButton({ fallback = "/" }: { fallback?: string }) {
  const router = useRouter();

  return (
    <Button
      icon={<ArrowLeftOutlined />}
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallback);
        }
      }}
      style={{ position: "fixed", top: 16, left: 16, zIndex: 1000 }}
    >
      Back
    </Button>
  );
}
