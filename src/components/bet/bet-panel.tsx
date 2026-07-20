"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, Typography, Button, Space, Tag, message, Modal, InputNumber, Table, Statistic, Row, Col, Divider, Empty, Tooltip } from "antd";
import { DollarOutlined, TrophyOutlined, ThunderboltOutlined, ReloadOutlined, BarChartOutlined } from "@ant-design/icons";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus } from "@/domain/types";
import { BetService } from "@/domain/services/bet.service";
import type { Bet, BetterProfile } from "@/domain/bet";
import { MIN_BET, MAX_BET } from "@/domain/bet";

const { Text } = Typography;

interface Props {
  matches: Match[];
  participants: Participant[];
  currentUserId: string;
  currentUserName: string;
  eventId: string;
  onBetUpdate?: () => void;
}

export function BetPanel({ matches, participants, currentUserId, currentUserName, eventId, onBetUpdate }: Props) {
  const [betModal, setBetModal] = useState<Match | null>(null);
  const [betAmount, setBetAmount] = useState(MIN_BET);
  const [betTargetId, setBetTargetId] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const betSvc = useMemo(() => new BetService(), []);
  const participantMap = useMemo(() => new Map(participants.map(p => [p.id, p.displayName])), [participants]);

  const [profile, setProfile] = useState<BetterProfile>({ id: "", name: "", totalPoints: 0, betsWon: 0, betsLost: 0, totalWagered: 0, netPoints: 0 });

  useEffect(() => {
    (async () => {
      const p = await betSvc.getOrCreateProfile(currentUserId, currentUserName);
      setProfile(p);
    })();
  }, [betSvc, currentUserId, currentUserName, refreshKey]);

  const upcomingMatches = useMemo(() =>
    matches.filter(m => m.status === MatchStatus.Scheduled && m.participantIds.length === 2),
    [matches]
  );

  const completedMatches = useMemo(() =>
    matches.filter(m => m.status === MatchStatus.Completed && m.result),
    [matches]
  );

  const [allBets, setAllBets] = useState<Bet[]>([]);

  useEffect(() => {
    (async () => {
      const bets = await betSvc.getEventBets(eventId);
      setAllBets(bets);
    })();
  }, [betSvc, eventId, refreshKey]);

  const myBets = useMemo(() => allBets.filter(b => b.betterId === currentUserId), [allBets, currentUserId]);

  const [leaderboard, setLeaderboard] = useState<BetterProfile[]>([]);

  useEffect(() => {
    (async () => {
      const lb = await betSvc.getLeaderboard(10);
      setLeaderboard(lb);
    })();
  }, [betSvc, refreshKey]);

  const handlePlaceBet = useCallback(async () => {
    if (!betModal || !betTargetId) return;
    setPlacing(true);
    try {
      const result = await betSvc.placeBet(currentUserId, currentUserName, betModal.id, eventId, betTargetId, betAmount);
      if (typeof result === "string") {
        message.error(result);
      } else {
        message.success(`Bet placed! Wagered ${betAmount} points.`);
        setBetModal(null);
        setRefreshKey(k => k + 1);
        onBetUpdate?.();
      }
    } catch {
      message.error("Failed to place bet");
    } finally {
      setPlacing(false);
    }
  }, [betModal, betTargetId, betAmount, betSvc, currentUserId, currentUserName, eventId, onBetUpdate]);

  return (
    <Card
      title={<Space><DollarOutlined style={{ color: "#52c41a" }} /> Betting (Fun)</Space>}
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Space>
          <Tag icon={<TrophyOutlined />} color="gold">
            {profile.totalPoints} pts
          </Tag>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)} />
        </Space>
      }
    >
      {/* Profile Stats */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "#f6ffed" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Points</Text>
            <div><Text strong style={{ fontSize: 18, color: "#52c41a" }}>{profile.totalPoints}</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "#fff7e6" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Won</Text>
            <div><Text strong style={{ fontSize: 18, color: "#fa8c16" }}>{profile.betsWon}</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "#fff1f0" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Lost</Text>
            <div><Text strong style={{ fontSize: 18, color: "#ff4d4f" }}>{profile.betsLost}</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "#f0f5ff" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Net</Text>
            <div>
              <Text strong style={{ fontSize: 18, color: profile.netPoints >= 0 ? "#52c41a" : "#ff4d4f" }}>
                {profile.netPoints >= 0 ? "+" : ""}{profile.netPoints}
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* My Bets */}
      {myBets.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <Text strong style={{ fontSize: 12 }}>My Bets</Text>
          <Table
            dataSource={myBets.slice(-5).reverse()}
            rowKey="id"
            pagination={false}
            size="small"
            columns={[
              {
                title: "Match", key: "match",
                render: (_: unknown, record: Bet) => {
                  const m = matches.find(m => m.id === record.matchId);
                  if (!m) return "?";
                  return m.participants.map(p => participantMap.get(p.participantId) ?? "?").join(" vs ");
                },
              },
              {
                title: "Bet On", key: "target",
                render: (_: unknown, record: Bet) => participantMap.get(record.participantId) ?? "?",
              },
              {
                title: "Wager", dataIndex: "pointsWagered", key: "wager",
                render: (v: number) => <Text>{v} pts</Text>,
              },
              {
                title: "Status", key: "status",
                render: (_: unknown, record: Bet) => record.settled
                  ? <Tag color={record.won ? "success" : "error"}>{record.won ? `Won +${record.pointsAwarded}` : "Lost"}</Tag>
                  : <Tag color="processing">Active</Tag>,
              },
            ]}
          />
        </div>
      )}

      <Divider style={{ margin: "8px 0" }} />

      {/* Available Matches to Bet On */}
      {upcomingMatches.length > 0 && (
        <div>
          <Text strong style={{ fontSize: 12 }}>Place Bets on Upcoming Matches</Text>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            {upcomingMatches.slice(0, 5).map(m => {
              const myExistingBet = myBets.find(b => b.matchId === m.id);
              const p1Name = participantMap.get(m.participantIds[0]) ?? "?";
              const p2Name = participantMap.get(m.participantIds[1]) ?? "?";

              if (myExistingBet) {
                return (
                  <Card key={m.id} size="small" style={{ background: "#f6ffed" }}>
                    <Space>
                      <Text style={{ fontSize: 12 }}>{p1Name} vs {p2Name}</Text>
                      <Tag color="green">Bet on {participantMap.get(myExistingBet.participantId)} ({myExistingBet.pointsWagered} pts)</Tag>
                    </Space>
                  </Card>
                );
              }

              return (
                <Card key={m.id} size="small" style={{ background: "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space>
                      <Text style={{ fontSize: 12 }}>{p1Name}</Text>
                      <Text type="secondary">vs</Text>
                      <Text style={{ fontSize: 12 }}>{p2Name}</Text>
                    </Space>
                    <Button
                      size="small"
                      icon={<DollarOutlined />}
                      onClick={() => {
                        setBetModal(m);
                        setBetTargetId(null);
                        setBetAmount(MIN_BET);
                      }}
                    >
                      Bet
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Leaderboard */}
      {leaderboard.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Divider style={{ margin: "8px 0" }} />
          <Text strong style={{ fontSize: 12 }}><BarChartOutlined /> Betting Leaderboard</Text>
          <Table
            dataSource={leaderboard}
            rowKey="id"
            pagination={false}
            size="small"
            style={{ marginTop: 6 }}
            columns={[
              {
                title: "#", key: "rank", width: 30,
                render: (_: unknown, __: unknown, i: number) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  return <Text>{medals[i] || `#${i + 1}`}</Text>;
                },
              },
              { title: "Better", dataIndex: "name", key: "name", render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
              {
                title: "Points", dataIndex: "totalPoints", key: "points",
                render: (v: number) => <Text strong style={{ color: "#52c41a" }}>{v}</Text>,
              },
              {
                title: "W/L", key: "wl",
                render: (_: unknown, record: BetterProfile) => (
                  <Text style={{ fontSize: 11 }}>
                    {record.betsWon}W - {record.betsLost}L
                  </Text>
                ),
              },
            ]}
          />
        </div>
      )}

      {/* Bet Modal */}
      <Modal
        title="Place Your Bet"
        open={!!betModal}
        onCancel={() => setBetModal(null)}
        onOk={handlePlaceBet}
        okText="Place Bet"
        confirmLoading={placing}
        okButtonProps={{ disabled: !betTargetId }}
      >
        {betModal && (
          <div>
            <Text style={{ display: "block", marginBottom: 12, textAlign: "center" }}>
              Who will win?
            </Text>
            <Space style={{ width: "100%", justifyContent: "center", marginBottom: 16 }}>
              {betModal.participants.map(p => {
                const name = participantMap.get(p.participantId) ?? "?";
                return (
                  <Card
                    key={p.participantId}
                    hoverable
                    size="small"
                    style={{
                      width: 140,
                      textAlign: "center",
                      border: betTargetId === p.participantId ? "2px solid #52c41a" : "1px solid #d9d9d9",
                    }}
                    onClick={() => setBetTargetId(p.participantId)}
                  >
                    <Text strong={betTargetId === p.participantId}>{name}</Text>
                    {betTargetId === p.participantId && <Tag color="green" style={{ display: "block", marginTop: 4 }}>Selected</Tag>}
                  </Card>
                );
              })}
            </Space>
            <div style={{ textAlign: "center" }}>
              <Text>Wager (payout: 2x):</Text>
              <div style={{ marginTop: 8 }}>
                <InputNumber
                  min={MIN_BET}
                  max={Math.min(MAX_BET, profile.totalPoints)}
                  value={betAmount}
                  onChange={v => setBetAmount(v ?? MIN_BET)}
                  style={{ width: 120 }}
                  addonAfter="pts"
                />
              </div>
              <Text type="secondary" style={{ display: "block", marginTop: 4, fontSize: 11 }}>
                Min: {MIN_BET} | Max: {Math.min(MAX_BET, profile.totalPoints)} | Balance: {profile.totalPoints} pts
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
