"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams } from "next/navigation";
import { Card, Typography, Tag, Spin, Space, Row, Col, Empty, Table, Alert, Tabs, Button } from "antd";
import { TrophyOutlined, ScheduleOutlined, TeamOutlined, NodeIndexOutlined, ReloadOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import type { Competition } from "@/domain/competition";
import type { Event, Stage, Round } from "@/domain/event";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import { MatchStatus, FormatType } from "@/domain/types";
import { StandingsService } from "@/domain/services/standings.service";
import type { StandingsEntry } from "@/domain/formats/interface";
import { StandingsTable } from "@/components/standings/standings-table";
import { GroupStandingsView } from "@/components/standings/group-standings-view";
import { BracketView } from "@/components/bracket/bracket-view";
import { AiInsights } from "@/components/ai/ai-insights";
import { useApp } from "@/lib/app-context";
import { BetPanel } from "@/components/bet/bet-panel";

const { Title, Text } = Typography;

export default function OrgLivePage() {
  const params = useParams();
  const compId = params.compId as string;
  const orgSlug = params.orgSlug as string;
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
  const [activeTabKey, setActiveTabKey] = useState<string>("overview");

  const compSvc = new CompetitionService();
  const evtSvc = new EventService();
  const regSvc = new RegistrationService();
  const standingSvc = new StandingsService();

  const loadEventData = async (eventId: string) => {
    const loadedStages = await evtSvc.getStages(eventId);
    const allRounds = (await Promise.all(loadedStages.map((s: Stage) => evtSvc.getRounds(s.id)))).flat();
    const roundIds = new Set(allRounds.map(r => r.id));
    const allMatches = (await evtSvc.getMatches(eventId)).filter((m: Match) => roundIds.has(m.roundId));
    const loadedParticipants = await regSvc.getParticipants(eventId);

    setStages(loadedStages);
    setAllRounds(allRounds);
    setMatches(allMatches);
    setParticipants(loadedParticipants);

    if (loadedStages.length > 0) {
      try {
        const result = await standingSvc.calculate(eventId, loadedStages[loadedStages.length - 1].id);
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
    () => stages.find(s => s.type === "single_elimination" || s.type === "double_elimination") ?? null,
    [stages]
  );

  const roundMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRounds) map.set(r.id, r.name);
    return map;
  }, [allRounds]);

  const bracketRounds = useMemo(
    () => bracketStage ? allRounds.filter(r => r.stageId === bracketStage.id) : [],
    [bracketStage, allRounds]
  );

  const bracketMatches = useMemo(() => {
    if (!bracketStage) return [];
    const roundIds = new Set(bracketRounds.map(r => r.id));
    return matches.filter(m => roundIds.has(m.roundId));
  }, [bracketStage, bracketRounds, matches]);

  const activeEvent = events.find(e => e.id === activeEventId);

  const groupConfig = stages[0]?.config?.groups as string[][] | undefined;
  const isGroupStage = stages.length > 0 && stages[0].type === "group_stage" && !!groupConfig;

  const groupNames = useMemo(() => {
    if (!isGroupStage || !groupConfig) return [];
    return groupConfig.map((_, i) => String.fromCharCode(65 + i));
  }, [isGroupStage, groupConfig]);

  const liveMatches = matches.filter(m => m.status === MatchStatus.InProgress || m.status === MatchStatus.Scheduled);
  const completedMatches = matches.filter(m => m.status === MatchStatus.Completed || m.status === MatchStatus.Walkover);

  if (loading && !competition) {
    return <Spin style={{ display: "flex", justifyContent: "center", marginTop: 100 }} />;
  }

  if (error) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        <Alert message={error} type="error" showIcon />
      </div>
    );
  }

  const tabItems = [
    {
      key: "overview",
      label: "Overview",
      children: (
        <div>
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col span={6}>
              <Card size="small"><StatisticLike label="Participants" value={participants.length} icon={<TeamOutlined />} /></Card>
            </Col>
            <Col span={6}>
              <Card size="small"><StatisticLike label="Matches" value={matches.length} icon={<ScheduleOutlined />} /></Card>
            </Col>
            <Col span={6}>
              <Card size="small"><StatisticLike label="Completed" value={completedMatches.length} icon={<TrophyOutlined />} /></Card>
            </Col>
            <Col span={6}>
              <Card size="small"><StatisticLike label="Live" value={liveMatches.length} icon={<NodeIndexOutlined />} /></Card>
            </Col>
          </Row>

          {liveMatches.length > 0 && (
            <Card title={<Space><ReloadOutlined spin /> Live Matches</Space>} style={{ marginBottom: 16 }}>
              <Table
                dataSource={liveMatches}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "Match", key: "matchup",
                    render: (_: unknown, record: Match) => (
                      <Text>{record.participants.map(p => participants.find(pp => pp.id === p.participantId)?.displayName ?? "?").join(" vs ")}</Text>
                    ),
                  },
                  {
                    title: "Status", dataIndex: "status", key: "status",
                    render: (s: MatchStatus) => <Tag color={s === MatchStatus.InProgress ? "processing" : "default"}>{s}</Tag>,
                  },
                  {
                    title: "Round", key: "round",
                    render: (_: unknown, record: Match) => record.roundId ? roundMap.get(record.roundId) ?? "-" : "-",
                  },
                  {
                    title: "Bracket", key: "bracket",
                    render: (_: unknown, record: Match) => record.bracketGroup ? <Tag>{record.bracketGroup}</Tag> : null,
                  },
                  {
                    title: "Predict", key: "predict",
                    render: (_: unknown, record: Match) => record.participants.length === 2 ? (
                      <Button size="small" onClick={() => setActiveTabKey("predictions")}>Predict</Button>
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
                    title: "Match", key: "matchup",
                    render: (_: unknown, record: Match) => (
                      <Text>{record.participants.map(p => participants.find(pp => pp.id === p.participantId)?.displayName ?? "?").join(" vs ")}</Text>
                    ),
                  },
                  {
                    title: "Winner", key: "winner",
                    render: (_: unknown, record: Match) => record.result?.winnerId
                      ? <Tag color="green">{participants.find(p => p.id === record.result!.winnerId)?.displayName ?? "?"}</Tag>
                      : <Tag color="gold">Draw</Tag>,
                  },
                  {
                    title: "Score", key: "score",
                    render: (_: unknown, record: Match) => record.result?.scores && record.result.scores.length > 0
                      ? record.result.scores.map(s => `${participants.find(p => p.id === s.participantId)?.displayName ?? "?"}: ${s.value}`).join(" | ")
                      : "-",
                  },
                  {
                    title: "Round", key: "round",
                    render: (_: unknown, record: Match) => record.roundId ? roundMap.get(record.roundId) ?? "-" : "-",
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
    ...(matches.length > 0 ? [{
      key: "insights",
      label: <Space><ThunderboltOutlined /> AI Insights</Space>,
      children: activeEvent ? (
        <AiInsights
          matches={matches}
          participants={participants}
          eventName={activeEvent.name}
          autoAnalyze
        />
      ) : <Empty description="Select an event to view insights" />,
    }] : []),
    ...(standings.length > 0 ? [{
      key: "standings",
      label: "Standings",
      children: isGroupStage
        ? <GroupStandingsView standings={standings} event={activeEvent!} groupNames={groupNames} />
        : <StandingsTable standings={standings} event={activeEvent!} />,
    }] : []),
    ...(bracketMatches.length > 0 ? [{
      key: "bracket",
      label: "Bracket",
      children: (
        <BracketView
          matches={bracketMatches}
          participants={participants}
          rounds={bracketRounds}
        />
      ),
    }] : []),
    ...(currentMember ? [{
      key: "predictions",
      label: <Space><span style={{ color: "#52c41a" }}>$</span> Predictions (Tournament Oracle)</Space>,
      children: activeEvent ? (
        <BetPanel
          matches={matches}
          participants={participants}
          currentUserId={currentMember.id}
          currentUserName={currentMember.displayName ?? currentMember.email}
          eventId={activeEvent.id}
          onBetUpdate={() => setRefreshKey(k => k + 1)}
        />
      ) : null,
    }] : []),
  ];

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>{competition?.name}</Title>
          <Text type="secondary">Live View</Text>
        </div>
        <Space>
          {events.length > 1 && (
            <Space>
              {events.map(e => (
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
          <Button icon={<ReloadOutlined />} onClick={() => setRefreshKey(k => k + 1)}>Refresh</Button>
        </Space>
      </div>

      {activeEvent && (
        <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={tabItems} />
      )}

      {events.length === 0 && (
        <Empty description="No events found." />
      )}
    </div>
  );
}

function StatisticLike({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontSize: 24, color: "#1677ff" }}>{icon}</div>
      <div style={{ fontSize: 24, fontWeight: 600 }}>{value}</div>
      <div style={{ fontSize: 13, color: "#888" }}>{label}</div>
    </div>
  );
}
