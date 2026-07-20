"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Card,
  Typography,
  Spin,
  Tag,
  Space,
  Row,
  Col,
  Progress,
  Button,
  Empty,
} from "antd";
import {
  ThunderboltOutlined,
  ReloadOutlined,
  TrophyOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  RiseOutlined,
  FallOutlined,
  SwapOutlined,
  BarChartOutlined,
  AimOutlined,
  StarOutlined,
} from "@ant-design/icons";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus } from "@/domain/types";
import { ScoreAuditService } from "@/domain/services/score-audit.service";
import type {
  ParticipantScoreSummary,
  InterestingFact,
  MatchInsight,
} from "@/domain/score-audit";

const { Text, Title } = Typography;

interface Props {
  matches: Match[];
  participants: Participant[];
  eventName: string;
  autoAnalyze?: boolean;
  compact?: boolean;
}

function getSeverityColor(severity: InterestingFact["severity"]): string {
  switch (severity) {
    case "record":
      return "volcano";
    case "amazing":
      return "orange";
    case "interesting":
      return "gold";
    default:
      return "default";
  }
}

function getSeverityIcon(severity: InterestingFact["severity"]): React.ReactNode {
  switch (severity) {
    case "amazing":
    case "record":
      return <StarOutlined />;
    case "interesting":
      return <InfoCircleOutlined />;
    default:
      return <InfoCircleOutlined />;
  }
}

function FactCard({ fact }: { fact: InterestingFact }) {
  return (
    <Card size="small" style={{ marginBottom: 6 }}>
      <Space align="start" style={{ width: "100%" }}>
        <Tag
          color={getSeverityColor(fact.severity)}
          style={{ marginRight: 8, flexShrink: 0 }}
        >
          {getSeverityIcon(fact.severity)} {fact.title}
        </Tag>
        <Text style={{ fontSize: 12, lineHeight: "20px" }}>
          {fact.description}
        </Text>
      </Space>
    </Card>
  );
}

interface PlayerDeepDiveProps {
  player: ParticipantScoreSummary;
  color: string;
}

function PlayerDeepDive({ player, color }: PlayerDeepDiveProps) {
  const total = player.wins + player.losses + player.draws;
  const winRate = total > 0 ? Math.round((player.wins / total) * 100) : 0;

  return (
    <div style={{ marginBottom: 16, padding: 12, borderRadius: 10 }}>
      <Space style={{ marginBottom: 8 }}>
        <AimOutlined style={{ color }} />
        <Text strong style={{ fontSize: 14 }}>{player.displayName}</Text>
      </Space>

      <Row gutter={[8, 8]}>
        <Col span={8}>
          <div style={{ textAlign: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color }}>{player.wins}</Text>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Wins</Text>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: 700 }}>{winRate}%</Text>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Win Rate</Text>
          </div>
        </Col>
        <Col span={8}>
          <div style={{ textAlign: "center" }}>
            <Text style={{ fontSize: 20, fontWeight: 700, color: player.currentWinStreak > 0 ? undefined : undefined }}>
              {player.currentWinStreak > 0
                ? `${player.currentWinStreak}W`
                : player.currentLossStreak > 0
                  ? `${player.currentLossStreak}L`
                  : "-"}
            </Text>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>Streak</Text>
          </div>
        </Col>
      </Row>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
          <Text type="secondary" style={{ fontSize: 11 }}>Win / Loss</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            {player.wins}W / {player.losses}L{player.draws > 0 ? ` / ${player.draws}D` : ""}
          </Text>
        </div>
        <Progress
          percent={winRate}
          showInfo={false}
          strokeColor={color}
          size="small"
          style={{ margin: 0 }}
        />
      </div>

      {player.last5Results.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11, display: "block", marginBottom: 2 }}>Recent Form</Text>
          <Space size={4}>
            {player.last5Results.slice(-5).map((r, i) => {
              const bg = r === "win" ? "#2ABFAA" : r === "loss" ? "#DC2626" : undefined;
              return (
                <span
                  key={i}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    background: bg,
                    color: bg ? "#fff" : undefined,
                    fontSize: 10,
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {r === "win" ? "W" : r === "loss" ? "L" : "D"}
                </span>
              );
            })}
          </Space>
        </div>
      )}

      {player.avgScoreFor > 0 && (
        <div style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
            Avg Score: {player.avgScoreFor.toFixed(1)} | Total Matches: {player.totalMatches}
          </Text>
        </div>
      )}
    </div>
  );
}

function ParticipantStatBar({
  label,
  p1Val,
  p2Val,
  p1Name,
  p2Name,
  suffix = "",
}: {
  label: string;
  p1Val: number;
  p2Val: number;
  p1Name: string;
  p2Name: string;
  suffix?: string;
}) {
  const total = p1Val + p2Val;
  const p1Pct = total > 0 ? Math.round((p1Val / total) * 100) : 50;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 2,
        }}
      >
        <Text type="secondary" style={{ fontSize: 11 }}>{label}</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Text
          style={{
            fontSize: 12,
            minWidth: 60,
            textAlign: "right",
            fontWeight: 500,
          }}
        >
          {p1Val}
          {suffix}
        </Text>
        <Progress
          percent={p1Pct}
          showInfo={false}
          size="small"
          style={{ flex: 1, margin: 0 }}
        />
        <Text style={{ fontSize: 12, minWidth: 60, fontWeight: 500 }}>
          {p2Val}
          {suffix}
        </Text>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 10 }}>{p1Name}</Text>
        <Text style={{ fontSize: 10 }}>{p2Name}</Text>
      </div>
    </div>
  );
}

export function AiInsights({
  matches,
  participants,
  eventName,
  autoAnalyze = true,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const auditSvc = useMemo(() => new ScoreAuditService(), []);

  const participantMap = useMemo(
    () => new Map(participants.map((p) => [p.id, p.displayName])),
    [participants],
  );

  const completedMatches = useMemo(
    () => matches.filter((m) => m.status === MatchStatus.Completed && m.result),
    [matches],
  );

  const upcomingMatches = useMemo(
    () =>
      matches.filter(
        (m) =>
          m.status === MatchStatus.Scheduled && m.participantIds.length === 2,
      ),
    [matches],
  );

  const getSummary = useCallback(
    (pid: string): ParticipantScoreSummary => {
      const name = participantMap.get(pid) ?? "Unknown";
      return auditSvc.getParticipantSummary(pid, name, "", completedMatches);
    },
    [auditSvc, participantMap, completedMatches],
  );

  const participantStats = useMemo(() => {
    const map = new Map<string, ParticipantScoreSummary>();
    for (const p of participants) {
      map.set(p.id, getSummary(p.id));
    }
    return map;
  }, [participants, getSummary]);

  const [matchInsights, setMatchInsights] = useState<Map<string, MatchInsight>>(new Map());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const insights = new Map<string, MatchInsight>();
      for (const m of matches) {
        if (m.participantIds.length !== 2) continue;
        const p1 = participantStats.get(m.participantIds[0]);
        const p2 = participantStats.get(m.participantIds[1]);
        if (!p1 || !p2) continue;
        const insight = await auditSvc.getMatchInsight(
          m,
          p1,
          p2,
          completedMatches,
          "",
        );
        insights.set(m.id, insight);
      }
      setMatchInsights(insights);
      setLoading(false);
    })();
  }, [matches, participantStats, auditSvc, completedMatches]);

  const globalFacts = useMemo(() => {
    const allFacts: InterestingFact[] = [];
    for (const [, insight] of matchInsights) {
      for (const f of insight.facts) {
        if (!allFacts.some((ex) => ex.description === f.description)) {
          allFacts.push(f);
        }
      }
    }
    return allFacts
      .sort((a, b) => {
        const order: Record<string, number> = { record: 0, amazing: 1, interesting: 2, normal: 3 };
        return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
      })
      .slice(0, 10);
  }, [matchInsights]);

  const topPlayers = useMemo(() => {
    const withMatches = Array.from(participantStats.values()).filter(
      (p) => p.totalMatches >= 1,
    );
    return withMatches.sort((a, b) => b.wins - a.wins).slice(0, 5);
  }, [participantStats]);

  const playerDeepDives = useMemo(() => {
    return Array.from(participantStats.values())
      .filter((p) => p.totalMatches >= 2)
      .sort((a, b) => b.totalMatches - a.totalMatches)
      .slice(0, 4);
  }, [participantStats]);

  const streakLeader = useMemo(() => {
    let best = 0;
    let name = "";
    for (const [, p] of participantStats) {
      if (p.currentWinStreak > best) {
        best = p.currentWinStreak;
        name = p.displayName;
      }
    }
    return best >= 2 ? { name, streak: best } : null;
  }, [participantStats]);

  const hasMeaningfulData =
    participants.length >= 2 &&
    (completedMatches.length > 0 || upcomingMatches.length > 0);
  if (!hasMeaningfulData) {
    return null;
  }

  return (
    <div style={{ marginTop: 16 }}>
      <Card
        title={
          <Space>
            <ThunderboltOutlined /> Tournament Insights
          </Space>
        }
        size="small"
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        }
      >
        {loading && (
          <Spin size="small" style={{ display: "block", margin: "16px auto" }} />
        )}

        {/* Interesting Facts */}
        {globalFacts.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 13 }}>
              <TrophyOutlined /> Event Highlights
            </Text>
            <div style={{ marginTop: 6 }}>
              {globalFacts.slice(0, 5).map((fact, i) => (
                <FactCard key={i} fact={fact} />
              ))}
            </div>
          </div>
        )}

        {/* Streak Leader */}
        {streakLeader && (
          <div style={{ marginBottom: 16, padding: "8px 12px", borderRadius: 10 }}>
            <Space>
              <RiseOutlined />
              <Text style={{ fontSize: 13 }}>
                <Text strong>{streakLeader.name}</Text> is on fire — {streakLeader.streak} consecutive wins
              </Text>
            </Space>
          </div>
        )}

        {/* Player Deep Dives */}
        {playerDeepDives.length >= 2 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 13 }}>
              <BarChartOutlined /> Player Deep Dive
            </Text>
            <div style={{ marginTop: 8 }}>
              {playerDeepDives.map((p, i) => {
                const colors = ["#E8A623", "#2ABFAA", "#F0EDE6", "#E8A623"];
                return (
                  <PlayerDeepDive key={p.participantId} player={p} color={colors[i % colors.length]} />
                );
              })}
            </div>
          </div>
        )}

        {/* Top Players Summary */}
        {topPlayers.length >= 2 && (
          <div style={{ marginBottom: 16 }}>
            <Text strong style={{ fontSize: 13 }}>
              <TrophyOutlined /> Leaderboard
            </Text>
            <div style={{ marginTop: 8 }}>
              <Row gutter={[8, 8]}>
                {topPlayers.map((p, i) => (
                  <Col key={p.participantId} span={Math.floor(24 / Math.min(topPlayers.length, 4))}>
                    <Card
                      size="small"
                      style={{
                        textAlign: "center",
                      }}
                    >
                      {i === 0 && (
                        <TrophyOutlined style={{ fontSize: 16, display: "block", marginBottom: 4 }} />
                      )}
                      <Text
                        style={{
                          fontSize: 12,
                          display: "block",
                          fontWeight: 600,
                        }}
                      >
                        {p.displayName}
                      </Text>
                      <Text
                        style={{
                          fontSize: 20,
                          fontWeight: 700,
                        }}
                      >
                        {p.wins}
                      </Text>
                      <Text
                        type="secondary"
                        style={{
                          display: "block",
                        }}
                      >
                        Wins
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>
                        Avg: {p.avgScoreFor.toFixed(1)} | {p.wins + p.losses + p.draws} games
                      </Text>
                    </Card>
                  </Col>
                ))}
              </Row>
            </div>
          </div>
        )}

        {/* Upcoming Matches */}
        {upcomingMatches.length > 0 && (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              <SwapOutlined /> Upcoming Matchups
            </Text>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                marginTop: 8,
              }}
            >
              {upcomingMatches.slice(0, 3).map((m) => {
                const p1Id = m.participantIds[0];
                const p2Id = m.participantIds[1];
                const p1Name = participantMap.get(p1Id) ?? "TBD";
                const p2Name = participantMap.get(p2Id) ?? "TBD";
                const p1 = participantStats.get(p1Id);
                const p2 = participantStats.get(p2Id);

                return (
                  <Card key={m.id} size="small">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <Space size={4} style={{ flex: 1, justifyContent: "center" }}>
                            <Text strong>
                          {p1Name}
                        </Text>
                        <Text type="secondary">vs</Text>
                        <Text strong>
                          {p2Name}
                        </Text>
                      </Space>
                    </div>

                    {p1 && p2 && (
                      <div>
                        <ParticipantStatBar
                          label="Wins"
                          p1Val={p1.wins}
                          p2Val={p2.wins}
                          p1Name={p1Name}
                          p2Name={p2Name}
                        />
                        <ParticipantStatBar
                          label="Avg Score"
                          p1Val={Math.round(p1.avgScoreFor * 10)}
                          p2Val={Math.round(p2.avgScoreFor * 10)}
                          p1Name={p1Name}
                          p2Name={p2Name}
                        />
                      </div>
                    )}

                    <Space wrap size={4} style={{ marginTop: 4 }}>
                      {p1?.currentWinStreak && p1.currentWinStreak >= 2 && (
                        <Tag
                          icon={<RiseOutlined />}
                          color="green"
                          style={{ fontSize: 10 }}
                        >
                          {p1Name}: {p1.currentWinStreak}W streak
                        </Tag>
                      )}
                      {p2?.currentWinStreak && p2.currentWinStreak >= 2 && (
                        <Tag
                          icon={<RiseOutlined />}
                          color="green"
                          style={{ fontSize: 10 }}
                        >
                          {p2Name}: {p2.currentWinStreak}W streak
                        </Tag>
                      )}
                      {p1?.currentLossStreak && p1.currentLossStreak >= 2 && (
                        <Tag
                          icon={<FallOutlined />}
                          color="red"
                          style={{ fontSize: 10 }}
                        >
                          {p1Name}: {p1.currentLossStreak}L streak
                        </Tag>
                      )}
                      {p2?.currentLossStreak && p2.currentLossStreak >= 2 && (
                        <Tag
                          icon={<FallOutlined />}
                          color="red"
                          style={{ fontSize: 10 }}
                        >
                          {p2Name}: {p2.currentLossStreak}L streak
                        </Tag>
                      )}
                    </Space>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Completed Match Stats */}
        {completedMatches.length >= 2 && upcomingMatches.length === 0 && (
          <div>
            <Text strong style={{ fontSize: 13 }}>
              <TrophyOutlined /> Tournament Statistics
            </Text>
            <div style={{ marginTop: 8 }}>
              <Row gutter={[8, 8]}>
                {topPlayers.slice(0, 4).map((p) => {
                  const total = p.wins + p.losses;
                  const rate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
                  return (
                    <Col key={p.participantId} span={6}>
                      <Card
                        size="small"
                        style={{ textAlign: "center" }}
                      >
                        <Text style={{ fontSize: 12, display: "block" }}>
                          {p.displayName}
                        </Text>
                        <Text strong style={{ fontSize: 18 }}>
                          {rate}%
                        </Text>
                        <Text
                          type="secondary"
                          style={{
                            display: "block",
                          }}
                        >
                          {p.wins}W - {p.losses}L
                          {p.draws > 0 ? ` - ${p.draws}D` : ""}
                        </Text>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            </div>
          </div>
        )}

        {error && (
          <Text type="danger" style={{ display: "block", marginTop: 8 }}>
            {error}
          </Text>
        )}
      </Card>
    </div>
  );
}
