"use client";

import { useState, useEffect } from "react";
import { Modal, Typography, Tag, Spin, Space } from "antd";
import { TrophyOutlined, CommentOutlined } from "@ant-design/icons";
import type { Match, MatchComment, MatchScore } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { GetWhere } from "@/lib/store";
import LiveTimer from "./live-timer";
import CommentaryFeed from "./commentary-feed";

const { Title, Text } = Typography;

function getCommentaryKey(matchId: string, scores: MatchScore[]): string {
  return `${matchId}-${scores.map(s => `${s.participantId}:${s.value}`).join(",")}`;
}

export default function MatchDetailModal({
  match,
  participants,
  open,
  onClose,
}: {
  match: Match;
  participants: Participant[];
  open: boolean;
  onClose: () => void;
}) {
  const [comments, setComments] = useState<MatchComment[]>([]);
  const [commentLoading, setCommentLoading] = useState(false);
  const [lastCommentKey, setLastCommentKey] = useState("");

  const isLive = match.status === "in_progress";
  const matchScores: MatchScore[] = (match as any).scores ?? [];
  const posOrder = new Map(match.participants.map(mp => [mp.participantId, mp.position]));
  const orderedScores = [...matchScores].sort((a, b) => (posOrder.get(a.participantId) ?? 0) - (posOrder.get(b.participantId) ?? 0));
  const commentKey = getCommentaryKey(match.id, matchScores);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setCommentLoading(true);
      try {
        const data = await GetWhere<MatchComment>("match_comments", { matchId: match.id });
        const sorted = data.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        setComments(sorted);
      } catch { /* silent */ }
      setCommentLoading(false);
    })();
  }, [open, match.id]);

  useEffect(() => {
    if (!isLive || !open || commentKey === lastCommentKey || matchScores.length === 0) return;
    setLastCommentKey(commentKey);

    const timeout = setTimeout(async () => {
      try {
        const participantInfo = matchScores.map((s) => {
          const p = participants.find((pp) => pp.id === s.participantId);
          return { name: p?.displayName ?? "?", score: s.value };
        });
        const res = await fetch("/api/ai/commentary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: match.id,
            matchName: `${participantInfo.map(p => p.name).join(" vs ")}`,
            participants: participantInfo,
          }),
        });
        const json = await res.json();
        if (json.data?.text) {
          setComments(prev => [...prev, {
            id: json.data.id ?? crypto.randomUUID(),
            matchId: match.id,
            text: json.data.text,
            createdAt: new Date().toISOString(),
          }]);
        }
      } catch { /* silent */ }
    }, 3000);

    return () => clearTimeout(timeout);
  }, [commentKey, isLive, open]);

  return (
    <Modal
      title={
        <Space>
          {isLive && orderedScores.length === 2 ? (
            <Text strong style={{ fontSize: 15 }}>
              {participants.find(p => p.id === orderedScores[0].participantId)?.displayName ?? "?"} {orderedScores[0].value}
              {" — "}
              {orderedScores[1].value} {participants.find(p => p.id === orderedScores[1].participantId)?.displayName ?? "?"}
            </Text>
          ) : (
            <span>Match Details</span>
          )}
          {isLive && <Tag color="red" style={{ animation: "pulse 2s infinite" }}>LIVE</Tag>}
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      {matchScores.length <= 2 && orderedScores.length > 0 ? (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "20px 0",
        }}>
          {orderedScores.map((s, i) => {
            const p = participants.find(pp => pp.id === s.participantId);
            const isWinner = i === 0 && !isLive;
            return (
              <div key={s.participantId} style={{ textAlign: "center", flex: 1 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%",
                  background: isWinner ? "linear-gradient(135deg, #f59e0b, #d97706)" : "linear-gradient(135deg, #3b82f6, #1e3a8a)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 8px",
                  fontSize: 20, fontWeight: 700, color: "#fff",
                }}>
                  {p?.displayName?.charAt(0) ?? "?"}
                </div>
                <Text strong style={{ display: "block", fontSize: 15 }}>{p?.displayName ?? "?"}</Text>
                <Text style={{
                  fontSize: 36, fontWeight: 800, display: "block",
                  color: isWinner ? "#f59e0b" : "#1e293b",
                  fontVariantNumeric: "tabular-nums",
                }}>
                  {s.value}
                </Text>
                {isWinner && <TrophyOutlined style={{ color: "#f59e0b", fontSize: 18 }} />}
              </div>
            );
          })}
          {isLive && (
            <div style={{ textAlign: "center" }}>
              <LiveTimer startedAt={match.startedAt} />
            </div>
          )}
        </div>
      ) : (
        <div>
          {orderedScores.map((s, i) => {
            const p = participants.find(pp => pp.id === s.participantId);
            return (
              <div key={s.participantId} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "8px 0", borderBottom: "1px solid #f0f0f0",
              }}>
                <Space>
                  <Tag color={i === 0 ? "gold" : i === 1 ? "default" : i === 2 ? "orange" : "default"}>
                    #{i + 1}
                  </Tag>
                  <Text strong>{p?.displayName ?? "?"}</Text>
                </Space>
                <Text style={{ fontSize: 20, fontWeight: 700 }}>{s.value}</Text>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginBottom: 16, padding: "12px 0", borderTop: "1px solid #f0f0f0" }}>
        <Space direction="vertical" size={4}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Status: <Tag>{match.status}</Tag>
          </Text>
          {match.startedAt && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Started: {new Date(match.startedAt).toLocaleTimeString()}
            </Text>
          )}
        </Space>
      </div>

      <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: 12 }}>
        <Text strong style={{ fontSize: 13, display: "block", marginBottom: 8 }}>
          <CommentOutlined style={{ marginRight: 6 }} />AI Commentary
        </Text>
        <CommentaryFeed comments={comments} loading={commentLoading} />
      </div>
    </Modal>
  );
}
