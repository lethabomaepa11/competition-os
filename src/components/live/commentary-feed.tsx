"use client";

import { useEffect, useRef } from "react";
import { Typography, Spin, Empty } from "antd";
import { CommentOutlined } from "@ant-design/icons";
import type { MatchComment } from "@/domain/match";

const { Text } = Typography;

export default function CommentaryFeed({ comments, loading }: { comments: MatchComment[]; loading: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  return (
    <div style={{ maxHeight: 300, overflowY: "auto", padding: "8px 0" }}>
      {loading && comments.length === 0 && (
        <Spin style={{ display: "flex", justifyContent: "center", padding: 24 }} />
      )}
      {!loading && comments.length === 0 && (
        <Empty description="No commentary yet. Score changes will appear here." image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
      {comments.map((c) => (
        <div key={c.id} style={{ display: "flex", gap: 8, padding: "6px 0", borderBottom: "1px solid #f0f0f0" }}>
          <CommentOutlined style={{ color: "#8b5cf6", fontSize: 14, marginTop: 2, flexShrink: 0 }} />
          <div>
            <Text style={{ fontSize: 13, lineHeight: 1.5 }}>{c.text}</Text>
            <div>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {new Date(c.createdAt).toLocaleTimeString()}
              </Text>
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
