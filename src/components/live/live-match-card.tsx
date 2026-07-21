"use client";

import { Typography, Tag, Card, Space } from "antd";
import { TrophyOutlined, TeamOutlined } from "@ant-design/icons";
import type { Match, MatchScore } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import LiveTimer from "./live-timer";

const { Text } = Typography;

export default function LiveMatchCard({
  match,
  participants,
  onClick,
}: {
  match: Match;
  participants: Participant[];
  onClick: () => void;
}) {
  const scores: MatchScore[] = (match as any).scores ?? [];
  const sortedScores = [...scores].sort((a, b) => b.value - a.value);

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        borderRadius: 16,
        border: "2px solid #22c55e",
        background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
        marginBottom: 16,
        cursor: "pointer",
      }}
      styles={{ body: { padding: "16px 20px" } }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Space direction="vertical" size={2}>
          <Space>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#22c55e", display: "inline-block",
              animation: "pulse 2s infinite",
            }} />
            <Tag color="green" style={{ fontWeight: 700, fontSize: 11 }}>LIVE</Tag>
          </Space>
          <LiveTimer startedAt={match.startedAt} />
        </Space>
        <TeamOutlined style={{ color: "#22c55e", fontSize: 18 }} />
      </div>

      <div style={{ marginTop: 12 }}>
        {sortedScores.length <= 2 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
            {sortedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              const isLeading = i === 0;
              return (
                <div key={s.participantId} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: isLeading ? "linear-gradient(135deg, #22c55e, #16a34a)" : "#94a3b8",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 4px", color: "#fff", fontWeight: 700, fontSize: 14,
                  }}>
                    {p?.displayName?.charAt(0) ?? "?"}
                  </div>
                  <Text strong style={{ fontSize: 13, display: "block" }}>{p?.displayName ?? "?"}</Text>
                  <Text style={{
                    fontSize: 28, fontWeight: 800, display: "block",
                    color: isLeading ? "#16a34a" : "#64748b",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {s.value}
                  </Text>
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {sortedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              return (
                <div key={s.participantId} style={{
                  display: "flex", justifyContent: "space-between", padding: "4px 0",
                }}>
                  <Space>
                    <Tag color={i === 0 ? "gold" : "default"} style={{ fontSize: 10 }}>#{i + 1}</Tag>
                    <Text style={{ fontSize: 13 }}>{p?.displayName ?? "?"}</Text>
                  </Space>
                  <Text style={{ fontWeight: 700, fontSize: 16 }}>{s.value}</Text>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
