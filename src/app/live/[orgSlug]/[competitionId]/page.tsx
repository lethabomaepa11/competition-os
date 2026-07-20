"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import {
  Card,
  Typography,
  Tag,
  Spin,
  Space,
  Row,
  Col,
  Empty,
  Table,
  Alert,
  Tabs,
  Button,
} from "antd";
import {
  TrophyOutlined,
  ScheduleOutlined,
  TeamOutlined,
  NodeIndexOutlined,
  ReloadOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { MatchService } from "@/domain/services/match.service";
import type { Competition } from "@/domain/competition";
import type { Event, Stage, Round } from "@/domain/event";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus, FormatType } from "@/domain/types";
import { StandingsService } from "@/domain/services/standings.service";
import type { StandingsEntry } from "@/domain/formats/interface";
import { StandingsTable } from "@/components/standings/standings-table";
import { BracketView } from "@/components/bracket/bracket-view";
import { AiInsights } from "@/components/ai/ai-insights";
import { AppProvider, useApp } from "@/lib/app-context";
import { BetPanel } from "@/components/bet/bet-panel";

const { Title, Text } = Typography;

function LiveContent() {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const compId = params.competitionId as string;
  const { currentMember } = useApp();

  const [competition, setCompetition] = useState<Competition | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const compSvc = new CompetitionService();
  const evtSvc = new EventService();
  const regSvc = new RegistrationService();
  const standingSvc = new StandingsService();
  const matchSvc = new MatchService();

  const loadEventData = async (eventId: string) => {
    const loadedStages = await evtSvc.getStages(eventId);
    const roundArrays = await Promise.all(
      loadedStages.map((s: Stage) => evtSvc.getRounds(s.id)),
    );
    const loadedRounds = roundArrays.flat();
    const roundIds = new Set(loadedRounds.map((r) => r.id));
    const allMatches = (await matchSvc.list(eventId)).filter((m: Match) =>
      roundIds.has(m.roundId),
    );
    const loadedParticipants = await regSvc.getParticipants(eventId);

    setStages(loadedStages);
    setAllRounds(loadedRounds);
    setMatches(allMatches);
    setParticipants(loadedParticipants);

    if (loadedStages.length > 0) {
      try {
        const result = await standingSvc.calculate(
          eventId,
          loadedStages[loadedStages.length - 1].id,
        );
        setStandings(result);
      } catch {
        setStandings([]);
      }
    }
  };

  const refresh = async () => {
    setLoading(true);
    setError(null);
    const comp = await compSvc.get(compId);
    setCompetition(comp ?? null);
    if (!comp) {
      setError("Competition not found");
      setLoading(false);
      return;
    }
    const evts = await evtSvc.list(comp.id);
    setEvents(evts);
    if (evts.length > 0 && !activeEventId) {
      setActiveEventId(evts[0].id);
      await loadEventData(evts[0].id);
    } else if (activeEventId) {
      await loadEventData(activeEventId);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!compId) return;
    refresh();
  }, [compId, refreshKey]);

  const handleSelectEvent = async (eventId: string) => {
    setActiveEventId(eventId);
    await loadEventData(eventId);
  };

  const bracketStage = useMemo(
    () =>
      stages.find(
        (s) =>
          s.type === "single_elimination" || s.type === "double_elimination",
      ) ?? null,
    [stages],
  );

  const bracketRounds = useMemo(
    () =>
      bracketStage
        ? allRounds.filter((r) => r.stageId === bracketStage.id)
        : [],
    [bracketStage, allRounds],
  );

  const bracketMatches = useMemo(() => {
    if (!bracketStage) return [];
    const roundIds = new Set(bracketRounds.map((r) => r.id));
    return matches.filter((m) => roundIds.has(m.roundId));
  }, [bracketStage, bracketRounds, matches]);

  const activeEvent = events.find((e) => e.id === activeEventId);

  if (loading && !competition) {
    return (
      <Spin
        style={{ display: "flex", justifyContent: "center", marginTop: 100 }}
      />
    );
  }

  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        <Alert message={error} type="error" showIcon />
      </div>
    );
  }

  const liveMatches = matches.filter(
    (m) =>
      m.status === MatchStatus.InProgress || m.status === MatchStatus.Scheduled,
  );
  const completedMatches = matches.filter(
    (m) =>
      m.status === MatchStatus.Completed || m.status === MatchStatus.Walkover,
  );

  const tabItems = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small">
                <StatisticLike
                  label="Participants"
                  value={participants.length}
                  icon={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <StatisticLike
                  label="Matches"
                  value={matches.length}
                  icon={<ScheduleOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <StatisticLike
                  label="Completed"
                  value={completedMatches.length}
                  icon={<TrophyOutlined />}
                />
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small">
                <StatisticLike
                  label="Live"
                  value={liveMatches.length}
                  icon={<NodeIndexOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {liveMatches.length > 0 && (
            <Card
              title={
                <Space>
                  <ReloadOutlined spin /> Live Matches
                </Space>
              }
              style={{ marginBottom: 16 }}
            >
              <Table
                dataSource={liveMatches}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "Match",
                    key: "matchup",
                    render: (_: unknown, record: Match) => {
                      const matchParticipants = record.participants ?? [];
                      const names =
                        matchParticipants.length > 0
                          ? matchParticipants
                              .map(
                                (p) =>
                                  participants.find(
                                    (pp) => pp.id === p.participantId,
                                  )?.displayName ?? "?",
                              )
                              .join(" vs ")
                          : "TBD";
                      return <Text>{names}</Text>;
                    },
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    render: (s: MatchStatus) => (
                      <Tag
                        color={
                          s === MatchStatus.InProgress
                            ? "processing"
                            : "default"
                        }
                      >
                        {s}
                      </Tag>
                    ),
                  },
                  {
                    title: "Bracket",
                    key: "bracket",
                    render: (_: unknown, record: Match) =>
                      record.bracketGroup ? (
                        <Tag>{record.bracketGroup}</Tag>
                      ) : null,
                  },
                ]}
              />
            </Card>
          )}

          {completedMatches.length > 0 && (
            <Card title="Recent Results" size="small">
              <Table
                dataSource={completedMatches.slice(-10).reverse()}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "Match",
                    key: "matchup",
                    render: (_: unknown, record: Match) => {
                      const matchParticipants = record.participants ?? [];
                      const names =
                        matchParticipants.length > 0
                          ? matchParticipants
                              .map(
                                (p) =>
                                  participants.find(
                                    (pp) => pp.id === p.participantId,
                                  )?.displayName ?? "?",
                              )
                              .join(" vs ")
                          : "TBD";
                      return <Text>{names}</Text>;
                    },
                  },
                  {
                    title: "Winner",
                    key: "winner",
                    render: (_: unknown, record: Match) =>
                      record.result?.winnerId ? (
                        <Tag color="green">
                          {participants.find(
                            (p) => p.id === record.result!.winnerId,
                          )?.displayName ?? "?"}
                        </Tag>
                      ) : (
                        <Tag color="gold">Draw</Tag>
                      ),
                  },
                  {
                    title: "Score",
                    key: "score",
                    render: (_: unknown, record: Match) =>
                      record.result?.scores && record.result.scores.length > 0
                        ? record.result.scores
                            .map(
                              (s) =>
                                `${participants.find((p) => p.id === s.participantId)?.displayName ?? "?"}: ${s.value}`,
                            )
                            .join(" | ")
                        : "-",
                  },
                ]}
              />
            </Card>
          )}

          {liveMatches.length === 0 && completedMatches.length === 0 && (
            <Empty description="No match data yet. Check back when the event starts." />
          )}
        </div>
      ),
    },
    ...(matches.length > 0
      ? [
          {
            key: "insights",
            label: (
              <Space>
                <ThunderboltOutlined /> AI Insights
              </Space>
            ),
            children: activeEvent ? (
              <AiInsights
                matches={matches}
                participants={participants}
                eventName={activeEvent.name}
                autoAnalyze
              />
            ) : (
              <Empty description="Select an event to view insights" />
            ),
          },
        ]
      : []),
    ...(standings.length > 0
      ? [
          {
            key: "standings",
            label: "Standings",
            children: (
              <StandingsTable standings={standings} event={activeEvent!} />
            ),
          },
        ]
      : []),
    ...(bracketMatches.length > 0
      ? [
          {
            key: "bracket",
            label: "Bracket",
            children: (
              <BracketView
                matches={bracketMatches}
                participants={participants}
                rounds={bracketRounds}
              />
            ),
          },
        ]
      : []),
    ...(currentMember && matches.length > 0
      ? [
          {
            key: "betting",
            label: (
              <Space>
                <span style={{ color: "#52c41a" }}>$</span> Betting
              </Space>
            ),
            children: activeEvent ? (
              <BetPanel
                matches={matches}
                participants={participants}
                currentUserId={currentMember.id}
                currentUserName={
                  currentMember.displayName ?? currentMember.email
                }
                eventId={activeEvent.id}
                onBetUpdate={() => setRefreshKey((k) => k + 1)}
              />
            ) : null,
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        maxWidth: 1000,
        margin: "0 auto",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <Title level={3} style={{ margin: 0 }}>
            {competition?.name}
          </Title>
          <Text type="secondary">Live View</Text>
        </div>
        <Space>
          {events.length > 1 && (
            <Space>
              {events.map((e) => (
                <Button
                  key={e.id}
                  type={activeEventId === e.id ? "primary" : "default"}
                  size="small"
                  onClick={() => handleSelectEvent(e.id)}
                >
                  {e.name}
                </Button>
              ))}
            </Space>
          )}
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {activeEvent && <Tabs items={tabItems} />}

      {events.length === 0 && <Empty description="No events found." />}
    </div>
  );
}

export default function LiveParticipantPage() {
  return (
    <AppProvider>
      <LiveContent />
    </AppProvider>
  );
}

function StatisticLike({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="stat-card animate-fade-in-up"
      style={{
        textAlign: "center",
        cursor: "default",
        padding: "16px 8px",
        borderRadius: 16,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.9) 0%, rgba(248,250,252,0.9) 100%)",
        border: "1px solid #f1f5f9",
        transition: "all 0.35s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div
        className="stat-icon"
        style={{
          fontSize: 32,
          color: "#1677ff",
          filter: "drop-shadow(0 6px 12px rgba(30,58,138,0.15))",
        }}
      >
        {icon}
      </div>
      <div
        className="animate-count-pulse"
        style={{
          fontSize: 32,
          fontWeight: 800,
          color: "#0f172a",
          letterSpacing: "-0.02em",
          marginTop: 6,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#64748b",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
