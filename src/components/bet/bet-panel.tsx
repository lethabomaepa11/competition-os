"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, Typography, Button, Space, Tag, message, Modal, InputNumber, Table, Row, Col, Divider, Tooltip } from "antd";
import { DollarOutlined, TrophyOutlined, ThunderboltOutlined, ReloadOutlined, BarChartOutlined } from "@ant-design/icons";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus } from "@/domain/types";
import { BetService } from "@/domain/services/bet.service";
import type { Bet, BetterProfile } from "@/domain/bet";
import { MIN_BET, MAX_BET } from "@/domain/bet";
import { calculatePredictionOdds } from "@/domain/prediction-odds";

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

  const [allBets, setAllBets] = useState<Bet[]>([]);
  const market = betModal && betModal.participantIds.length === 2
    ? calculatePredictionOdds(matches, betModal.participantIds[0], betModal.participantIds[1])
    : null;
  const selectedPrice = market && betTargetId
    ? market[betModal?.participantIds.indexOf(betTargetId) ?? -1]
    : undefined;

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
    const prices = betModal.participantIds.length === 2
      ? calculatePredictionOdds(matches, betModal.participantIds[0], betModal.participantIds[1])
      : null;
    const priceIndex = betModal.participantIds.indexOf(betTargetId);
    const price = priceIndex >= 0 ? prices?.[priceIndex] : undefined;
    if (!price) {
      message.info("Odds will appear after both entrants have completed at least one match.");
      return;
    }
    setPlacing(true);
    try {
      const result = await betSvc.placeBet(currentUserId, currentUserName, betModal.id, eventId, betTargetId, betAmount, price.decimalOdds);
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
  }, [betModal, betTargetId, betAmount, betSvc, currentUserId, currentUserName, eventId, matches, onBetUpdate]);

  return (
    <Card
      title={<Space><DollarOutlined style={{ color: "var(--competition-accent, #1c5fd4)" }} /> Match predictions</Space>}
      size="small"
      style={{ marginTop: 16 }}
      extra={
        <Space>
          <Tag icon={<TrophyOutlined />} color="blue">
            {profile.totalPoints} pts
          </Tag>
          <Button size="small" icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)} />
        </Space>
      }
    >
      <div style={{ textAlign: "center", marginBottom: 12, background: "color-mix(in srgb, var(--competition-accent, #1c5fd4) 7%, white)", padding: "6px 12px", borderRadius: 6 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <ThunderboltOutlined style={{ marginRight: 4 }} />
          Just for fun — no real money. Bragging rights only!
        </Text>
      </div>
      {/* Profile Stats */}
      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "color-mix(in srgb, var(--competition-accent, #1c5fd4) 5%, white)" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Points</Text>
            <div><Text strong style={{ fontSize: 18, color: "var(--competition-accent, #2457b8)" }}>{profile.totalPoints}</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "color-mix(in srgb, var(--competition-accent, #1c5fd4) 5%, white)" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Won</Text>
            <div><Text strong style={{ fontSize: 18, color: "var(--competition-accent, #2457b8)" }}>{profile.betsWon}</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "color-mix(in srgb, var(--competition-accent, #1c5fd4) 5%, white)" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Lost</Text>
            <div><Text strong style={{ fontSize: 18, color: "#486179" }}>{profile.betsLost}</Text></div>
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ textAlign: "center", background: "color-mix(in srgb, var(--competition-accent, #1c5fd4) 5%, white)" }}>
            <Text style={{ fontSize: 11, color: "#888" }}>Net</Text>
            <div>
              <Text strong style={{ fontSize: 18, color: profile.netPoints >= 0 ? "var(--competition-accent, #2457b8)" : "#486179" }}>
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
              { title: "Fair odds", dataIndex: "decimalOdds", key: "odds", render: (v?: number) => v ? <Tag color="blue">{v.toFixed(2)}</Tag> : <Text type="secondary">—</Text> },
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
          <Text strong style={{ fontSize: 12 }}>Predict an upcoming match</Text>
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 6 }}>
            {upcomingMatches.slice(0, 5).map(m => {
              const myExistingBet = myBets.find(b => b.matchId === m.id);
              const p1Name = participantMap.get(m.participantIds[0]) ?? "?";
              const p2Name = participantMap.get(m.participantIds[1]) ?? "?";
              const prices = calculatePredictionOdds(matches, m.participantIds[0], m.participantIds[1]);

              if (myExistingBet) {
                return (
                  <Card key={m.id} size="small" style={{ background: "color-mix(in srgb, var(--competition-accent, #1c5fd4) 7%, white)" }}>
                    <Space>
                      <Text style={{ fontSize: 12 }}>{p1Name} vs {p2Name}</Text>
                      <Tag color="blue">Predicted {participantMap.get(myExistingBet.participantId)} ({myExistingBet.pointsWagered} pts)</Tag>
                    </Space>
                  </Card>
                );
              }

              return (
                <Card key={m.id} size="small" style={{ background: "#fafafa" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Space wrap>
                      <Text style={{ fontSize: 12 }}>{p1Name}</Text>
                      <Text type="secondary">vs</Text>
                      <Text style={{ fontSize: 12 }}>{p2Name}</Text>
                      {prices ? <Tooltip title={`Fair estimate from completed event matches. Samples: ${prices[0].sampleSize} and ${prices[1].sampleSize}; no bookmaker margin.`}><Tag color="blue">{Math.round(prices[0].probability * 100)}% · {prices[0].decimalOdds.toFixed(2)}</Tag><Tag color="blue">{Math.round(prices[1].probability * 100)}% · {prices[1].decimalOdds.toFixed(2)}</Tag></Tooltip> : <Tooltip title="Both entrants need at least one completed result before estimates are shown."><Tag>Odds developing</Tag></Tooltip>}
                    </Space>
                    <Button
                      size="small"
                      icon={<DollarOutlined />}
                      disabled={!prices}
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
                  return <TrophyOutlined style={{ color: i === 0 ? "var(--competition-accent, #2457b8)" : "#94a7c5" }} />;
                },
              },
              { title: "Better", dataIndex: "name", key: "name", render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
              {
                title: "Points", dataIndex: "totalPoints", key: "points",
                render: (v: number) => <Text strong style={{ color: "var(--competition-accent, #2457b8)" }}>{v}</Text>,
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
        okButtonProps={{ disabled: !betTargetId || !selectedPrice }}
      >
        {betModal && (
          <div>
            <Text style={{ display: "block", marginBottom: 12, textAlign: "center" }}>
              Who will win?
            </Text>
            {market ? <Text type="secondary" style={{ display: "block", marginBottom: 12, textAlign: "center" }}>Illustrative event-form estimate · fair decimal odds · no real money</Text> : <Text type="secondary" style={{ display: "block", marginBottom: 12, textAlign: "center" }}>Odds need a completed result from both entrants first. No guesswork while the sample is empty.</Text>}
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
                      border: betTargetId === p.participantId ? "2px solid var(--competition-accent, #1c5fd4)" : "1px solid #d9d9d9",
                    }}
                    onClick={() => setBetTargetId(p.participantId)}
                  >
                    <Text strong={betTargetId === p.participantId}>{name}</Text>
                    {market && <Text type="secondary" style={{ display: "block", fontSize: 11 }}>{Math.round(market[betModal.participantIds.indexOf(p.participantId)].probability * 100)}% · {market[betModal.participantIds.indexOf(p.participantId)].decimalOdds.toFixed(2)}</Text>}
                    {betTargetId === p.participantId && <Tag color="blue" style={{ display: "block", marginTop: 4 }}>Selected</Tag>}
                  </Card>
                );
              })}
            </Space>
            <div style={{ textAlign: "center" }}>
              <Text>Prediction points:</Text>
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
                {selectedPrice ? `Potential total return: ${Math.round(betAmount * selectedPrice.decimalOdds)} pts at ${selectedPrice.decimalOdds.toFixed(2)}` : "Potential return appears when the sample is ready."} · Balance: {profile.totalPoints} pts
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
