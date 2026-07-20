"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Card, Typography, Spin, Tag, Space, Row, Col, Progress, Divider, Tooltip, Button, Empty } from "antd";
import { ThunderboltOutlined, ReloadOutlined, FireOutlined, TrophyOutlined, WarningOutlined, InfoCircleOutlined, RiseOutlined, FallOutlined, SwapOutlined, BarChartOutlined } from "@ant-design/icons";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus } from "@/domain/types";
import { ScoreAuditService } from "@/domain/services/score-audit.service";
import type { ParticipantScoreSummary, InterestingFact, MatchInsight } from "@/domain/score-audit";

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
    case "record": return "volcano";
    case "amazing": return "orange";
    case "interesting": return "gold";
    default: return "default";
  }
}

function getSeverityIcon(severity: InterestingFact["severity"]): React.ReactNode {
  switch (severity) {
    case "amazing":
    case "record": return <FireOutlined />;
    case "interesting": return <InfoCircleOutlined />;
    default: return <InfoCircleOutlined />;
  }
}

function FactCard({ fact }: { fact: InterestingFact }) {
  return (
    <Card size="small" style={{ background: "#fafafa", marginBottom: 6 }}>
      <Space align="start" style={{ width: "100%" }}>
        <Tag color={getSeverityColor(fact.severity)} style={{ marginRight: 8, flexShrink: 0 }}>
          {getSeverityIcon(fact.severity)} {fact.title}
        </Tag>
        <Text style={{ fontSize: 12, lineHeight: "20px" }}>{fact.description}</Text>
      </Space>
    </Card>
  );
}

function ParticipantStatBar({ label, p1Val, p2Val, p1Name, p2Name, suffix = "" }: {
  label: string; p1Val: number; p2Val: number; p1Name: string; p2Name: string; suffix?: string;
}) {
  const total = p1Val + p2Val;
  const p1Pct = total > 0 ? Math.round((p1Val / total) * 100) : 50;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <Text style={{ fontSize: 11, color: "#666" }}>{label}</Text>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Text style={{ fontSize: 12, minWidth: 60, textAlign: "right", fontWeight: 500 }}>{p1Val}{suffix}</Text>
        <Progress
          percent={p1Pct}
          showInfo={false}
          strokeColor="#1677ff"
          trailColor="#fa8c16"
          size="small"
          style={{ flex: 1, margin: 0 }}
        />
        <Text style={{ fontSize: 12, minWidth: 60, fontWeight: 500 }}>{p2Val}{suffix}</Text>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 10, color: "#1677ff" }}>{p1Name}</Text>
        <Text style={{ fontSize: 10, color: "#fa8c16" }}>{p2Name}</Text>
      </div>
    </div>
  );
}

export function AiInsights({ matches, participants, eventName, autoAnalyze = true, compact = false }: Props) {
  const [analysisMap, setAnalysisMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [activeTab /* unused */, setActiveTab] = useState<"upcoming" | "completed">("upcoming");
  const initialized = useRef(false);

  const auditSvc = useMemo(() => new ScoreAuditService(), []);

  const participantMap = useMemo(() => new Map(participants.map(p => [p.id, p.displayName])), [participants]);

  const completedMatches = useMemo(() =>
    matches.filter(m => m.status === MatchStatus.Completed && m.result),
    [matches]
  );

  const upcomingMatches = useMemo(() =>
    matches.filter(m => m.status === MatchStatus.Scheduled && m.participantIds.length === 2),
    [matches]
  );

  const getSummary = useCallback((pid: string): ParticipantScoreSummary => {
    const name = participantMap.get(pid) ?? "Unknown";
    return auditSvc.getParticipantSummary(pid, name, "", completedMatches);
  }, [auditSvc, participantMap, completedMatches]);

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
    const insights = new Map<string, MatchInsight>();
    for (const m of matches) {
      if (m.participantIds.length !== 2) continue;
      const p1 = participantStats.get(m.participantIds[0]);
      const p2 = participantStats.get(m.participantIds[1]);
      if (!p1 || !p2) continue;
      const insight = await auditSvc.getMatchInsight(m, p1, p2, completedMatches, "");
      insights.set(m.id, insight);
    }
    setMatchInsights(insights);
    })();
  }, [matches, participantStats, auditSvc, completedMatches]);

  const factsByMatch = useMemo(() => {
    const map = new Map<string, InterestingFact[]>();
    for (const [matchId, insight] of matchInsights) {
      if (insight.facts.length > 0) {
        map.set(matchId, insight.facts);
      }
    }
    return map;
  }, [matchInsights]);

  const globalFacts = useMemo(() => {
    const allFacts: InterestingFact[] = [];
    for (const [, facts] of factsByMatch) {
      for (const f of facts) {
        if (!allFacts.some(ex => ex.description === f.description)) {
          allFacts.push(f);
        }
      }
    }
    return allFacts.sort((a, b) => {
      const order = { record: 0, amazing: 1, interesting: 2, normal: 3 };
      return (order[a.severity] ?? 99) - (order[b.severity] ?? 99);
    }).slice(0, 10);
  }, [factsByMatch]);

  const analyzeMatchup = useCallback(async (p1Id: string, p2Id: string, p1Summary: ParticipantScoreSummary, p2Summary: ParticipantScoreSummary) => {
    const key = [p1Id, p2Id].sort().join("::");
    if (analysisMap[key] && !autoAnalyze) return;

    setLoading(prev => ({ ...prev, [key]: true }));
    setError(null);

    const p1Name = participantMap.get(p1Id) ?? "Unknown";
    const p2Name = participantMap.get(p2Id) ?? "Unknown";

    const h2hMatches = completedMatches.filter(
      m => m.participantIds.includes(p1Id) && m.participantIds.includes(p2Id)
    );

    const insight = matchInsights.get(
      completedMatches.find(m => m.participantIds.includes(p1Id) && m.participantIds.includes(p2Id))?.id ?? ""
    );

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "insights",
          participants: [
            {
              ...p1Summary,
              id: p1Id,
              displayName: p1Name,
              winProb: insight?.p1WinProb ?? 50,
              predictedScore: insight?.p1PredictedScore ?? 0,
            },
            {
              ...p2Summary,
              id: p2Id,
              displayName: p2Name,
              winProb: insight?.p2WinProb ?? 50,
              predictedScore: insight?.p2PredictedScore ?? 0,
            },
          ],
          recentMatches: completedMatches.map(m => ({
            p1Name: participantMap.get(m.participantIds[0]) ?? "?",
            p2Name: participantMap.get(m.participantIds[1]) ?? "?",
            winner: m.result?.winnerId ? participantMap.get(m.result.winnerId) : undefined,
          })),
          headToHeadMatches: h2hMatches.map(m => ({
            p1Name: participantMap.get(m.participantIds[0]) ?? "?",
            p2Name: participantMap.get(m.participantIds[1]) ?? "?",
            winner: m.result?.winnerId ? participantMap.get(m.result.winnerId) : undefined,
          })),
          eventName,
          interestingFacts: insight?.facts.map(f => f.description) ?? [],
        }),
      });

      const data = await res.json();
      if (data.analysis) {
        setAnalysisMap(prev => ({ ...prev, [key]: data.analysis }));
      } else {
        setError(data.error ?? "Failed to get analysis");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }));
    }
  }, [completedMatches, participantMap, eventName, analysisMap, autoAnalyze, matchInsights]);

  useEffect(() => {
    if (!autoAnalyze || initialized.current) return;
    initialized.current = true;
    for (const m of upcomingMatches) {
      if (m.participantIds.length !== 2) continue;
      const p1 = participantStats.get(m.participantIds[0]);
      const p2 = participantStats.get(m.participantIds[1]);
      if (p1 && p2) {
        analyzeMatchup(m.participantIds[0], m.participantIds[1], p1, p2);
      }
    }
  }, [autoAnalyze, upcomingMatches, participantStats, analyzeMatchup]);

  const topPlayers = useMemo(() => {
    const withMatches = Array.from(participantStats.values()).filter(p => p.totalMatches >= 1);
    return withMatches.sort((a, b) => b.wins - a.wins).slice(0, 5);
  }, [participantStats]);

  if (participants.length < 2) {
    return (
      <Card title={<Space><ThunderboltOutlined /> AI Match Insights</Space>} size="small">
        <Text type="secondary">Need at least 2 participants for analysis.</Text>
      </Card>
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      {!compact && (
        <Card
          title={<Space><ThunderboltOutlined style={{ color: "#faad14" }} /> AI Match Insights</Space>}
          size="small"
          extra={
            upcomingMatches.length > 0 && (
              <Button size="small" icon={<ReloadOutlined />} onClick={() => { initialized.current = false; setAnalysisMap({}); }}>
                Refresh
              </Button>
            )
          }
        >
          {/* Global Facts */}
          {globalFacts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}><TrophyOutlined /> Event Insights</Text>
              <div style={{ marginTop: 6 }}>
                {globalFacts.slice(0, 5).map((fact, i) => (
                  <FactCard key={i} fact={fact} />
                ))}
              </div>
            </div>
          )}

          {/* Top Players */}
          {topPlayers.length >= 2 && (
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13 }}><BarChartOutlined /> Player Stats Summary</Text>
              <div style={{ marginTop: 8 }}>
                <Row gutter={[8, 8]}>
                  {topPlayers.map(p => (
                    <Col key={p.participantId} span={Math.floor(24 / Math.min(topPlayers.length, 4))}>
                      <Card size="small" style={{ background: "#f5f5f5", textAlign: "center" }}>
                        <Text style={{ fontSize: 12, display: "block", fontWeight: 600 }}>{p.displayName}</Text>
                        <Text style={{ fontSize: 20, fontWeight: 700, color: "#1677ff" }}>{p.wins}</Text>
                        <Text style={{ fontSize: 11, color: "#888", display: "block" }}>Wins</Text>
                        <Text style={{ fontSize: 11, color: "#666" }}>
                          Avg: {p.avgScoreFor} | Streak: {p.currentWinStreak > 0 ? `🔥${p.currentWinStreak}` : p.currentLossStreak > 0 ? `💔${p.currentLossStreak}` : "-"}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </div>
            </div>
          )}

          {/* Upcoming Matches Analysis */}
          {upcomingMatches.length > 0 && (
            <div>
              <Text strong style={{ fontSize: 13 }}><SwapOutlined /> Match Predictions</Text>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
                {upcomingMatches.slice(0, 5).map(m => {
                  const p1Id = m.participantIds[0];
                  const p2Id = m.participantIds[1];
                  const p1Name = participantMap.get(p1Id) ?? "TBD";
                  const p2Name = participantMap.get(p2Id) ?? "TBD";
                  const key = [p1Id, p2Id].sort().join("::");
                  const isLoading = loading[key];
                  const analysis = analysisMap[key];
                  const insight = matchInsights.get(m.id);
                  const facts = factsByMatch.get(m.id) ?? [];
                  const p1 = participantStats.get(p1Id);
                  const p2 = participantStats.get(p2Id);

                  return (
                    <Card key={m.id} size="small" style={{ background: "#fafafa" }}>
                      {/* Matchup Header */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                          <Space size={4} style={{ flex: 1, justifyContent: "center" }}>
                            <Text strong style={{ color: "#1677ff" }}>{p1Name}</Text>
                            <Text type="secondary">vs</Text>
                            <Text strong style={{ color: "#fa8c16" }}>{p2Name}</Text>
                          </Space>
                        </div>

                        {/* Win Probability */}
                        {insight && (p1 || p2) && (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                              <Text style={{ fontSize: 11, color: "#1677ff", minWidth: 40, textAlign: "right" }}>
                                {insight.p1WinProb}%
                              </Text>
                              <Progress
                                percent={insight.p1WinProb}
                                showInfo={false}
                                strokeColor="#1677ff"
                                trailColor="#fa8c16"
                                size="small"
                                style={{ flex: 1, margin: 0 }}
                              />
                              <Text style={{ fontSize: 11, color: "#fa8c16", minWidth: 40 }}>
                                {insight.p2WinProb}%
                              </Text>
                            </div>
                            <div style={{ display: "flex", justifyContent: "space-between" }}>
                              <Text style={{ fontSize: 10, color: "#888" }}>Predicted: {insight.p1PredictedScore}</Text>
                              {insight.drawProb > 0 && (
                                <Tag color="default" style={{ fontSize: 10, lineHeight: "16px" }}>Draw {insight.drawProb}%</Tag>
                              )}
                              <Text style={{ fontSize: 10, color: "#888" }}>Predicted: {insight.p2PredictedScore}</Text>
                            </div>
                          </div>
                        )}

                        {/* Stats Comparison */}
                        {p1 && p2 && (
                          <div style={{ marginTop: 4 }}>
                            <ParticipantStatBar
                              label="Win Rate"
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

                        {/* Streaks */}
                        <Space wrap size={4} style={{ marginTop: 4 }}>
                          {p1?.currentWinStreak && p1.currentWinStreak >= 2 && (
                            <Tag icon={<RiseOutlined />} color="green" style={{ fontSize: 10 }}>
                              {p1Name}: {p1.currentWinStreak}W streak
                            </Tag>
                          )}
                          {p2?.currentWinStreak && p2.currentWinStreak >= 2 && (
                            <Tag icon={<RiseOutlined />} color="green" style={{ fontSize: 10 }}>
                              {p2Name}: {p2.currentWinStreak}W streak
                            </Tag>
                          )}
                          {p1?.currentLossStreak && p1.currentLossStreak >= 2 && (
                            <Tag icon={<FallOutlined />} color="red" style={{ fontSize: 10 }}>
                              {p1Name}: {p1.currentLossStreak}L streak
                            </Tag>
                          )}
                          {p2?.currentLossStreak && p2.currentLossStreak >= 2 && (
                            <Tag icon={<FallOutlined />} color="red" style={{ fontSize: 10 }}>
                              {p2Name}: {p2.currentLossStreak}L streak
                            </Tag>
                          )}
                          {p1 && p1.last5Results.length > 0 && (
                            <Tooltip title={`Recent form: ${p1.last5Results.map(r => r === "win" ? "✅" : r === "loss" ? "❌" : "➖").join(" ")}`}>
                              <Tag style={{ fontSize: 10 }}>
                                {p1Name}: {p1.last5Results.slice(-3).map(r => r === "win" ? "✅" : r === "loss" ? "❌" : "➖").join("")}
                              </Tag>
                            </Tooltip>
                          )}
                          {p2 && p2.last5Results.length > 0 && (
                            <Tooltip title={`Recent form: ${p2.last5Results.map(r => r === "win" ? "✅" : r === "loss" ? "❌" : "➖").join(" ")}`}>
                              <Tag style={{ fontSize: 10 }}>
                                {p2Name}: {p2.last5Results.slice(-3).map(r => r === "win" ? "✅" : r === "loss" ? "❌" : "➖").join("")}
                              </Tag>
                            </Tooltip>
                          )}
                        </Space>
                      </div>

                      {/* Facts for this match */}
                      {facts.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {facts.slice(0, 2).map((fact, i) => (
                            <FactCard key={i} fact={fact} />
                          ))}
                        </div>
                      )}

                      {/* AI Analysis */}
                      {isLoading && <Spin size="small" style={{ display: "block", margin: "8px auto" }} />}
                      {analysis && (
                        <div style={{ fontSize: 12, lineHeight: 1.6, color: "#333", whiteSpace: "pre-wrap", borderTop: "1px solid #f0f0f0", paddingTop: 8 }}>
                          {analysis}
                        </div>
                      )}
                      {!isLoading && !analysis && (
                        <Button
                          size="small"
                          icon={<ThunderboltOutlined />}
                          onClick={() => p1 && p2 && analyzeMatchup(p1Id, p2Id, p1, p2)}
                          block
                        >
                          AI Analysis
                        </Button>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed Match Stats */}
          {completedMatches.length >= 2 && upcomingMatches.length === 0 && (
            <div>
              <Text strong style={{ fontSize: 13 }}><TrophyOutlined /> Tournament Statistics</Text>
              <div style={{ marginTop: 8 }}>
                <Row gutter={[8, 8]}>
                  {topPlayers.slice(0, 4).map(p => {
                    const total = p.wins + p.losses;
                    const rate = total > 0 ? Math.round((p.wins / total) * 100) : 0;
                    return (
                      <Col key={p.participantId} span={6}>
                        <Card size="small" style={{ background: "#f5f5f5", textAlign: "center" }}>
                          <Text style={{ fontSize: 12, display: "block" }}>{p.displayName}</Text>
                          <Text strong style={{ fontSize: 18 }}>{rate}%</Text>
                          <Text style={{ fontSize: 11, color: "#888", display: "block" }}>{p.wins}W - {p.losses}L{p.draws > 0 ? ` - ${p.draws}D` : ""}</Text>
                        </Card>
                      </Col>
                    );
                  })}
                </Row>
              </div>
            </div>
          )}

          {upcomingMatches.length === 0 && completedMatches.length === 0 && (
            <Empty description="No matches to analyze yet." />
          )}

          {error && <Text type="danger" style={{ display: "block", marginTop: 8 }}>{error}</Text>}
        </Card>
      )}

      {/* Compact version just shows predictions */}
      {compact && upcomingMatches.length > 0 && (
        <Card
          title={<Space><ThunderboltOutlined style={{ color: "#faad14" }} /> Live Predictions</Space>}
          size="small"
          style={{ marginBottom: 16 }}
        >
          {upcomingMatches.slice(0, 3).map(m => {
            const p1Name = participantMap.get(m.participantIds[0]) ?? "TBD";
            const p2Name = participantMap.get(m.participantIds[1]) ?? "TBD";
            const insight = matchInsights.get(m.id);
            const facts = factsByMatch.get(m.id) ?? [];
            return (
              <div key={m.id} style={{ marginBottom: 8, padding: 8, background: "#fafafa", borderRadius: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text strong style={{ fontSize: 12, color: "#1677ff" }}>{p1Name}</Text>
                  <Text style={{ fontSize: 10, color: "#888" }}>vs</Text>
                  <Text strong style={{ fontSize: 12, color: "#fa8c16" }}>{p2Name}</Text>
                </div>
                {insight && (
                  <div>
                    <Progress
                      percent={insight.p1WinProb}
                      showInfo={false}
                      strokeColor="#1677ff"
                      trailColor="#fa8c16"
                      size="small"
                      style={{ margin: "2px 0" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 10, color: "#888" }}>{insight.p1WinProb}%</Text>
                      <Text style={{ fontSize: 10, color: "#888" }}>{insight.p2WinProb}%</Text>
                    </div>
                  </div>
                )}
                {facts.length > 0 && (
                  <Text style={{ fontSize: 10, color: "#666", display: "block", marginTop: 2 }}>
                    {facts[0].description}
                  </Text>
                )}
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
