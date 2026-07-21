"use client";

import { useRef, useEffect, useState } from "react";
import { Typography, Tag, Card, Space } from "antd";
import { ThunderboltOutlined, TeamOutlined } from "@ant-design/icons";
import type { Match, MatchScore } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import LiveTimer from "./live-timer";

const { Text } = Typography;

function ScoreValue({ value, participantId }: { value: number; participantId: string }) {
  const [animate, setAnimate] = useState(false);
  const prevRef = useRef(value);

  useEffect(() => {
    if (prevRef.current !== value) {
      prevRef.current = value;
      setAnimate(true);
      const t = setTimeout(() => setAnimate(false), 600);
      return () => clearTimeout(t);
    }
  }, [value]);

  return (
    <Text style={{
      fontSize: 36, fontWeight: 800, display: "block",
      color: "#fff",
      fontVariantNumeric: "tabular-nums",
      textShadow: animate ? "0 0 20px rgba(34, 197, 94, 0.7)" : "0 0 10px rgba(255,255,255,0.15)",
      transition: "text-shadow 0.3s ease",
    }}
      className={animate ? "animate-score-pop" : ""}
    >
      {value}
    </Text>
  );
}

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
  const positionOrder = new Map(match.participants.map(mp => [mp.participantId, mp.position]));
  const orderedScores = [...scores].sort((a, b) => (positionOrder.get(a.participantId) ?? 0) - (positionOrder.get(b.participantId) ?? 0));

  return (
    <Card
      hoverable
      onClick={onClick}
      style={{
        borderRadius: 16,
        border: "1px solid rgba(34, 197, 94, 0.35)",
        background: "linear-gradient(135deg, #0f1117 0%, #1a1d2e 50%, #0f1117 100%)",
        marginBottom: 16,
        marginTop: 24,
        cursor: "pointer",
        animation: "glowPulse 3s ease-in-out infinite",
        overflow: "hidden",
      }}
      styles={{
        body: { padding: "20px 24px", position: "relative" },
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 3,
        background: "linear-gradient(90deg, transparent, #22c55e, transparent)",
        opacity: 0.6,
      }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <Space direction="vertical" size={2}>
          <Space>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              background: "#22c55e", display: "inline-block",
              animation: "pulse 2s infinite",
              boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
            }} />
            <Tag color="green" style={{ fontWeight: 700, fontSize: 11, borderRadius: 6 }}>LIVE</Tag>
          </Space>
          <LiveTimer startedAt={match.startedAt} />
        </Space>
        <ThunderboltOutlined style={{ color: "#22c55e", fontSize: 20, opacity: 0.6 }} />
      </div>

      <div>
        {orderedScores.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
            {match.participants.map((mp) => {
              const p = participants.find(pp => pp.id === mp.participantId);
              return (
                <div key={mp.participantId} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "linear-gradient(135deg, #2a2d3e, #1a1d2e)",
                    border: "2px solid #2a2d3e",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px", color: "#94a3b8", fontWeight: 700, fontSize: 16,
                  }}>
                    {p?.displayName?.charAt(0) ?? "?"}
                  </div>
                  <Text strong style={{ fontSize: 14, display: "block", color: "#cbd5e1" }}>{p?.displayName ?? "?"}</Text>
                  <ScoreValue value={0} participantId={mp.participantId} />
                </div>
              );
            })}
          </div>
        ) : orderedScores.length <= 2 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 24 }}>
            {orderedScores.map((s) => {
              const p = participants.find(pp => pp.id === s.participantId);
              return (
                <div key={s.participantId} style={{ textAlign: "center", flex: 1 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    background: "linear-gradient(135deg, #2a2d3e, #1a1d2e)",
                    border: "2px solid #334155",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 8px", color: "#e2e8f0", fontWeight: 700, fontSize: 16,
                  }}>
                    {p?.displayName?.charAt(0) ?? "?"}
                  </div>
                  <Text strong style={{ fontSize: 14, display: "block", color: "#cbd5e1" }}>{p?.displayName ?? "?"}</Text>
                  <ScoreValue value={s.value} participantId={s.participantId} />
                </div>
              );
            })}
          </div>
        ) : (
          <div>
            {orderedScores.map((s, i) => {
              const p = participants.find(pp => pp.id === s.participantId);
              return (
                <div key={s.participantId} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "6px 0", borderBottom: i < orderedScores.length - 1 ? "1px solid #1e293b" : "none",
                }}>
                  <Space>
                    <Tag color={i === 0 ? "gold" : "default"} style={{ fontSize: 10, borderRadius: 4 }}>#{i + 1}</Tag>
                    <Text style={{ fontSize: 14, color: "#cbd5e1" }}>{p?.displayName ?? "?"}</Text>
                  </Space>
                  <Text style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>{s.value}</Text>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
