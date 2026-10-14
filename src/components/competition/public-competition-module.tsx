"use client";

import { useEffect, useMemo, useState } from "react";
import { Alert, Empty, Select, Skeleton, Space, Table, Tag, Typography } from "antd";
import type { Event } from "@/domain/event";
import type { Match } from "@/domain/match";
import type { Participant } from "@/domain/participant";
import type { StandingsEntry } from "@/domain/formats/interface";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { MatchService } from "@/domain/services/match.service";
import { StandingsService } from "@/domain/services/standings.service";
import { MatchStatus } from "@/domain/types";
import { StandingsTable } from "@/components/standings/standings-table";
import { GroupStandingsView } from "@/components/standings/group-standings-view";
import { BracketView } from "@/components/bracket/bracket-view";
import { PlayerStats } from "@/components/stats/player-stats";

const { Text } = Typography;
type ModuleKind = "standings" | "bracket" | "results" | "statistics" | "schedule" | "roster";

export function PublicCompetitionModule({ kind, title, events }: { kind: ModuleKind; title: string; events: Event[] }) {
  const [selectedEventId, setSelectedEventId] = useState<string>();
  const [loadedEventId, setLoadedEventId] = useState<string>();
  const [error, setError] = useState("");
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stages, setStages] = useState<Awaited<ReturnType<EventService["getStages"]>>>([]);
  const [rounds, setRounds] = useState<Awaited<ReturnType<EventService["getRounds"]>>>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  // Derive the active event from the props so asynchronous loads and
  // multi-event competitions always resolve to a real, still-valid event.
  const eventId = selectedEventId && events.some((item) => item.id === selectedEventId) ? selectedEventId : events[0]?.id;
  const loading = Boolean(eventId && eventId !== loadedEventId);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    const eventService = new EventService();
    void (async () => {
      try {
        const [item, loadedStages, entrants, allMatches] = await Promise.all([
          eventService.get(eventId),
          eventService.getStages(eventId),
          new RegistrationService().getParticipants(eventId),
          new MatchService().list(eventId),
        ]);
        const loadedRounds = (await Promise.all(loadedStages.map((stage) => eventService.getRounds(stage.id)))).flat();
        const activeMatches = allMatches.filter((match) => loadedRounds.some((round) => round.id === match.roundId));
        let computed: StandingsEntry[] = [];
        const stage = loadedStages.at(-1);
        if (stage) computed = await new StandingsService().calculate(eventId, stage.id).catch(() => []);
        if (!active) return;
        setEvent(item ?? null);
        setStages(loadedStages);
        setRounds(loadedRounds);
        setParticipants(entrants);
        setMatches(activeMatches);
        setStandings(computed);
        setError("");
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Could not load competition data");
      } finally {
        if (active) setLoadedEventId(eventId);
      }
    })();
    return () => { active = false; };
  }, [eventId]);

  const bracketStage = useMemo(() => [...stages].reverse().find((stage) => stage.type === "single_elimination" || stage.type === "double_elimination"), [stages]);
  const bracketRoundIds = useMemo(() => new Set(rounds.filter((round) => round.stageId === bracketStage?.id).map((round) => round.id)), [rounds, bracketStage]);
  const bracketMatches = useMemo(() => matches.filter((match) => bracketRoundIds.has(match.roundId)), [matches, bracketRoundIds]);
  const bracketRounds = useMemo(() => rounds.filter((round) => bracketRoundIds.has(round.id)), [rounds, bracketRoundIds]);
  const groupConfig = stages[0]?.config?.groups as string[][] | undefined;
  const groupNames = groupConfig?.map((_, index) => String.fromCharCode(65 + index)) ?? [];

  return <section style={{ margin: "24px 0", padding: "clamp(18px, 4vw, 32px)", border: "1px solid #e1e9f5", borderRadius: 18, background: "#fff" }}>
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <div style={{ display: "flex", gap: 16, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div><Text type="secondary">Live competition data</Text><Typography.Title level={3} style={{ margin: "4px 0" }}>{title}</Typography.Title></div>
        {events.length > 1 && <Select aria-label="Select event" value={eventId} onChange={setSelectedEventId} style={{ minWidth: 220 }} options={events.map((item) => ({ value: item.id, label: item.name }))} />}
      </div>
      {loading ? <Skeleton active paragraph={{ rows: 4 }} /> : error ? <Alert type="error" showIcon message="Competition data unavailable" description={error} /> : event?.config?.publicResults === false ? <Alert type="info" showIcon message="Results are private" description="The event operator has not enabled public results for this event." /> : !event ? <Empty description={events.length === 0 ? "No published events yet. Published events will appear here automatically." : "No event selected"} /> : kind === "standings" ? (groupConfig ? <GroupStandingsView standings={standings} event={event} groupNames={groupNames} /> : <StandingsTable standings={standings} event={event} />) : kind === "bracket" ? <BracketView matches={bracketMatches} participants={participants} rounds={bracketRounds} /> : kind === "statistics" ? <PlayerStats matches={matches} participants={participants} /> : kind === "roster" ? <Table<Participant>
        dataSource={participants.filter((participant) => participant.status !== "disqualified")}
        rowKey="id"
        locale={{ emptyText: "Approved entrants will appear here." }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 420 }}
        columns={[
          { title: "Entrant", dataIndex: "displayName", key: "name" },
          { title: "Seed", dataIndex: "seed", key: "seed", render: (seed?: number) => seed ?? "—" },
        ]}
      /> : <Table<Match>
        dataSource={(kind === "schedule" ? matches : matches.filter((match) => match.status === MatchStatus.Completed || match.status === MatchStatus.Walkover).slice().reverse())}
        rowKey="id"
        locale={{ emptyText: kind === "schedule" ? "Fixtures will appear when the event schedule is set." : "Results will appear after matches are completed." }}
        pagination={{ pageSize: 10, showSizeChanger: true }}
        scroll={{ x: 560 }}
        columns={[
          ...(kind === "schedule" ? [{ title: "Scheduled", key: "scheduled", render: (_: unknown, match: Match) => match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : "Time to be confirmed" }] : []),
          { title: "Fixture", key: "fixture", render: (_: unknown, match) => (match.participants ?? []).map((entry) => participants.find((participant) => participant.id === entry.participantId)?.displayName ?? "To be confirmed").join(" vs ") },
          ...(kind === "schedule" ? [{ title: "Status", dataIndex: "status", key: "status", render: (status: string) => <Tag color="blue">{status.replace(/_/g, " ")}</Tag> }] : []),
          { title: "Score", key: "score", render: (_: unknown, match) => match.result?.scores?.map((score) => `${participants.find((participant) => participant.id === score.participantId)?.displayName ?? "Entrant"} ${score.value}`).join(" · ") ?? "-" },
          { title: "Winner", key: "winner", render: (_: unknown, match) => match.result?.winnerId ? <Tag color="blue">{participants.find((participant) => participant.id === match.result?.winnerId)?.displayName ?? "Winner"}</Tag> : <Tag>Draw</Tag> },
        ]}
      />}
    </Space>
  </section>;
}
