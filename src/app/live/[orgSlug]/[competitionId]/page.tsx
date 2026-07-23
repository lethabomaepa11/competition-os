"use client";

import { useEffect, useState, useMemo, useRef } from "react";
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
import TipTapRenderer from "@/components/editor/tiptap-renderer";
import LiveMatchCard from "@/components/live/live-match-card";
import MatchDetailModal from "@/components/live/match-detail-modal";
import { createClient } from "@/lib/supabase/client";
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
  const [detailMatch, setDetailMatch] = useState<Match | null>(null);
  const commentKeyRef = useRef(0);

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

  useEffect(() => {
    if (!activeEventId) return;
    const supabase = createClient();
    const channel = supabase
      .channel("live-matches")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "matches" },
        (payload) => {
          if (!payload.new) return;
          const row = payload.new as any;
          if (row.event_id !== activeEventId) return;
          if (!row.id) return;

          const dbScores = row.scores as any[] | null;
          const scores = dbScores
            ? dbScores.map((s: any) => ({
                participantId: s.participant_id,
                label: s.label,
                value: s.value,
              }))
            : undefined;

          setMatches((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    status: row.status,
                    startedAt: row.started_at,
                    scores,
                  }
                : m,
            ),
          );
          setDetailMatch((prev) =>
            prev?.id === row.id
              ? ({
                  ...prev,
                  status: row.status,
                  startedAt: row.started_at,
                  scores,
                } as Match)
              : prev,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeEventId]);

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
  const inProgressMatches = matches.filter(
    (m) => m.status === MatchStatus.InProgress,
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
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={12} md={6}>
              <Card size="small">
                <StatisticLike
                  label="Participants"
                  value={participants.length}
                  icon={<TeamOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <StatisticLike
                  label="Matches"
                  value={matches.length}
                  icon={<ScheduleOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card size="small">
                <StatisticLike
                  label="Completed"
                  value={completedMatches.length}
                  icon={<TrophyOutlined />}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
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
                scroll={{ x: true }}
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
                scroll={{ x: true }}
                pagination={false}
                size="small"
                onRow={(record) => ({
                  onClick: () => setDetailMatch(record),
                  style: { cursor: "pointer" },
                })}
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
                <span style={{ color: "#52c41a" }}>$</span> Predictions
                (Tournament Oracle)
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
    <div>
      {/* Hero section */}
      <div
        style={{
          position: "relative",
          minHeight:
            activeEvent?.coverImage || competition?.coverImage ? 420 : 280,
          display: "flex",
          alignItems: "flex-end",
          overflow: "hidden",
          background:
            activeEvent?.coverImage || competition?.coverImage
              ? "none"
              : "linear-gradient(135deg, #0A0B0F 0%, #13141A 50%, #0A0B0F 100%)",
        }}
      >
        {(activeEvent?.coverImage || competition?.coverImage) && (
          <>
            <img
              src={activeEvent?.coverImage ?? competition?.coverImage ?? ""}
              alt=""
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(rgba(0,0,0,0.25) 0%, rgba(0,0,0,0.85) 100%)",
              }}
            />
          </>
        )}
        {!activeEvent?.coverImage && !competition?.coverImage && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              width: 500,
              height: 500,
              background:
                "radial-gradient(circle, rgba(232,166,35,0.06) 0%, transparent 70%)",
              pointerEvents: "none",
            }}
          />
        )}

        <div
          style={{
            position: "relative",
            zIndex: 1,
            padding:
              activeEvent?.coverImage || competition?.coverImage
                ? "120px 24px 48px"
                : "64px 24px 40px",
            maxWidth: 1000,
            margin: "0 auto",
            width: "100%",
          }}
        >
          <Space style={{ marginBottom: 12 }}>
            <Tag
              color="gold"
              style={{
                fontSize: 12,
                color: "#fff",
                textShadow: "0 2px 6px rgba(0,0,0,0.6)",
              }}
            >
              {competition?.game?.name ?? "Competition"}
            </Tag>
            <Tag
              style={{
                fontSize: 12,
                color: "#fff",
                textShadow: "0 2px 6px rgba(0,0,0,0.6)",
              }}
            >
              {events.length} {events.length === 1 ? "Event" : "Events"}
            </Tag>
          </Space>
          <Title
            level={1}
            style={{
              margin: 0,
              fontSize: 32,
              color: "#fff",
              textShadow: "0 2px 12px rgba(0,0,0,0.7)",
            }}
          >
            {competition?.name}
          </Title>
          {competition?.description && (
            <Text
              style={{
                display: "block",
                marginTop: 8,
                fontSize: 15,
                maxWidth: 600,
                color: "#fff",
                textShadow: "0 2px 12px rgba(0,0,0,0.7)",
              }}
            >
              {competition.description}
            </Text>
          )}

          {/* Event buttons */}
          {events.length > 1 && (
            <div style={{ marginTop: 24 }}>
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
            </div>
          )}
        </div>
      </div>

      {/* Content area */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "0 16px" }}>
        {/* TipTap content card */}
        {competition?.content && (
          <Card
            style={{
              marginBottom: 24,
              marginTop: -24,
              position: "relative",
              zIndex: 2,
            }}
          >
            <TipTapRenderer content={competition.content} />
          </Card>
        )}

        {/* Live match promotion */}
        {activeEvent && inProgressMatches.length > 0 && (
          <LiveMatchCard
            match={inProgressMatches[0]}
            participants={participants}
            onClick={() => setDetailMatch(inProgressMatches[0])}
          />
        )}

        {/* Match detail modal */}
        {detailMatch && (
          <MatchDetailModal
            match={detailMatch}
            participants={participants}
            open={!!detailMatch}
            onClose={() => setDetailMatch(null)}
          />
        )}

        {/* Refresh button + Tabs */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            marginBottom: 8,
          }}
        >
          <Button
            icon={<ReloadOutlined />}
            onClick={() => setRefreshKey((k) => k + 1)}
          >
            Refresh
          </Button>
        </div>

        {activeEvent && <Tabs items={tabItems} />}

        {events.length === 0 && <Empty description="No events found." />}
      </div>
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
  const gradients: Record<
    string,
    { iconBg: string; textBg: string; shadow: string }
  > = {
    Participants: {
      iconBg: "linear-gradient(135deg, #3b82f6, #1e3a8a)",
      textBg: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
      shadow: "rgba(59, 130, 246, 0.35)",
    },
    Matches: {
      iconBg: "linear-gradient(135deg, #f59e0b, #d97706)",
      textBg: "linear-gradient(135deg, #d97706, #f59e0b)",
      shadow: "rgba(245, 158, 11, 0.35)",
    },
    Completed: {
      iconBg: "linear-gradient(135deg, #22c55e, #16a34a)",
      textBg: "linear-gradient(135deg, #16a34a, #22c55e)",
      shadow: "rgba(34, 197, 94, 0.35)",
    },
    Live: {
      iconBg: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
      textBg: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
      shadow: "rgba(139, 92, 246, 0.35)",
    },
  };
  const g = gradients[label] ?? gradients.Participants;

  return (
    <div
      className="stat-card animate-fade-in-up"
      style={{
        textAlign: "center",
        cursor: "default",
        padding: "20px 8px",
        borderRadius: 20,
        background: "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
        border: "1px solid #e2e8f0",
        boxShadow:
          "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
        transition: "all 0.4s cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <div
        className="stat-icon"
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: g.iconBg,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 10px 25px ${g.shadow}`,
          marginBottom: 12,
        }}
      >
        <div style={{ color: "#fff", fontSize: 26 }}>{icon}</div>
      </div>
      <div
        className="animate-count-pulse"
        style={{
          fontSize: 36,
          fontWeight: 800,
          background: g.textBg,
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          letterSpacing: "-0.02em",
          marginTop: 4,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#64748b",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}
