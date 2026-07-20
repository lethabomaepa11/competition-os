"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Space,
  Tag,
  Tabs,
  Descriptions,
  message,
  Table,
  Badge,
  Modal,
  Input,
  InputNumber,
  Select,
  Form,
  Steps,
  Statistic,
  Divider,
  Collapse,
  Popconfirm,
} from "antd";
import {
  PlusOutlined,
  PlayCircleOutlined,
  SettingOutlined,
  TeamOutlined,
  ScheduleOutlined,
  TrophyOutlined,
  NodeIndexOutlined,
  SaveOutlined,
  LinkOutlined,
  StopOutlined,
  CopyOutlined,
  BugOutlined,
  ForwardOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  DeleteOutlined,
  RightOutlined,
  CheckCircleFilled,
  LockOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import { useApp } from "@/lib/app-context";
import ImageUpload from "@/components/upload/image-upload";
import { EventService } from "@/domain/services/event.service";
import { RegistrationService } from "@/domain/services/registration.service";
import { ParticipantInviteService } from "@/domain/services/participant-invite.service";
import { MemberService } from "@/domain/services/organization.service";
import type { ParticipantInvite } from "@/domain/participant-invite";
import { MatchService } from "@/domain/services/match.service";
import { StandingsService } from "@/domain/services/standings.service";
import type { Event, Round } from "@/domain/event";
import type { Stage } from "@/domain/event";
import type { Participant } from "@/domain/participant";
import type { Match } from "@/domain/match";
import {
  BracketGroup,
  EventStatus,
  FormatType,
  MatchStatus,
} from "@/domain/types";
import { canEditMatches } from "@/lib/permissions";
import { AiInsights } from "@/components/ai/ai-insights";
import { FormatRuleDefinitions } from "@/domain/rules";
import { getFormat } from "@/domain/formats/registry";
import { create, query, Delete, update } from "@/lib/store";
import type { StandingsEntry } from "@/domain/formats/interface";
import { ProgressionService } from "@/domain/services/progression.service";
import type {
  ProgressionPlan,
  PhaseConfig,
  ProgressionLink,
} from "@/domain/progression";
import { autoQualifierCount } from "@/domain/progression";
import { MatchListView } from "@/components/match/match-list";
import { StandingsTable } from "@/components/standings/standings-table";
import { BracketView } from "@/components/bracket/bracket-view";
import { compactRecipients, sendMailEvent } from "@/lib/mail/client";

const { Title, Text } = Typography;

function EventSettings({
  event,
  evtSvc,
}: {
  event: Event;
  evtSvc: EventService;
}) {
  const definitions = FormatRuleDefinitions[event.format];
  const [rules, setRules] = useState<Record<string, unknown>>({});

  useEffect(() => {
    (async () => {
      const ruleSet = await evtSvc.getRuleSet(event.id);
      if (ruleSet) {
        const map: Record<string, unknown> = {};
        for (const r of ruleSet.rules) map[r.key] = r.value;
        for (const d of definitions)
          if (map[d.key] === undefined) map[d.key] = d.defaultValue;
        setRules(map);
      } else {
        const defaultMap: Record<string, unknown> = {};
        for (const d of definitions) defaultMap[d.key] = d.defaultValue;
        setRules(defaultMap);
      }
    })();
  }, [event.id, evtSvc]);

  const handleSave = async () => {
    const overrides = Object.entries(rules).map(([key, value]) => ({
      key,
      value,
    }));
    await evtSvc.saveRuleSet(event.id, overrides);
    message.success("Rules saved!");
  };

  return (
    <div>
      <Title level={5}>Event Rules</Title>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        {definitions.map((def) => (
          <Card key={def.key} size="small" title={def.label}>
            {def.type === "boolean" ? (
              <Select
                value={(rules[def.key] as boolean) ?? def.defaultValue}
                onChange={(v) =>
                  setRules((prev) => ({ ...prev, [def.key]: v }))
                }
                style={{ width: "100%" }}
                options={[
                  { value: true, label: "Yes" },
                  { value: false, label: "No" },
                ]}
              />
            ) : def.type === "selection" ? (
              <Select
                value={(rules[def.key] as string) ?? def.defaultValue}
                onChange={(v) =>
                  setRules((prev) => ({ ...prev, [def.key]: v }))
                }
                style={{ width: "100%" }}
                options={
                  def.options?.map((o) => ({ value: o, label: o })) ?? []
                }
              />
            ) : def.type === "number" ? (
              <InputNumber
                value={(rules[def.key] as number) ?? def.defaultValue}
                onChange={(v) =>
                  setRules((prev) => ({ ...prev, [def.key]: v }))
                }
                style={{ width: "100%" }}
                min={def.validation?.min}
                max={def.validation?.max}
              />
            ) : (
              <Input
                value={(rules[def.key] as string) ?? def.defaultValue}
                onChange={(e) =>
                  setRules((prev) => ({ ...prev, [def.key]: e.target.value }))
                }
              />
            )}
            <Text
              type="secondary"
              style={{ display: "block", marginTop: 4, fontSize: 12 }}
            >
              Default: {String(def.defaultValue)}
            </Text>
          </Card>
        ))}
      </div>
      <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
        Save Rules
      </Button>
    </div>
  );
}

function SwissRoundStatus({
  stages,
  allRounds,
  matches,
}: {
  stages: Stage[];
  allRounds: Round[];
  matches: Match[];
}) {
  if (allRounds.length === 0) return null;
  const completedRoundNumbers = new Set(
    matches
      .filter(
        (m) =>
          m.status === MatchStatus.Completed ||
          m.status === MatchStatus.Walkover,
      )
      .map((m) => allRounds.find((r) => r.id === m.roundId)?.roundNumber)
      .filter((n): n is number => n !== undefined),
  );
  const totalRounds = Math.max(...allRounds.map((r) => r.roundNumber));
  const currentRound = Math.max(0, ...completedRoundNumbers) + 1;

  return (
    <div style={{ marginBottom: 16 }}>
      <Steps
        size="small"
        current={currentRound - 1}
        items={Array.from({ length: totalRounds }, (_, i) => ({
          title: `Round ${i + 1}`,
          status: (completedRoundNumbers.has(i + 1)
            ? "finish"
            : i + 1 === currentRound
              ? "process"
              : "wait") as "finish" | "process" | "wait",
        }))}
      />
    </div>
  );
}

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrg, currentMember } = useApp();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [standings, setStandings] = useState<StandingsEntry[]>([]);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [initModalOpen, setInitModalOpen] = useState(false);
  const [regLoading, setRegLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [seedModalOpen, setSeedModalOpen] = useState(false);
  const [seedCount, setSeedCount] = useState(8);
  const [invites, setInvites] = useState<ParticipantInvite[]>([]);
  const [allRounds, setAllRounds] = useState<Round[]>([]);
  const [swissGenerating, setSwissGenerating] = useState(false);
  const [selectedGroupIndex, setSelectedGroupIndex] = useState<number | null>(
    null,
  );
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);
  const [advancing, setAdvancing] = useState(false);
  const [phaseModalOpen, setPhaseModalOpen] = useState(false);
  const [phasePlan, setPhasePlan] = useState<ProgressionPlan | null>(null);
  const [progressionLinks, setProgressionLinks] = useState<ProgressionLink[]>(
    [],
  );
  const [newPhaseFormat, setNewPhaseFormat] = useState<FormatType>(
    FormatType.SingleElimination,
  );
  const [newPhaseQualifiers, setNewPhaseQualifiers] = useState(8);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [awardedPoints, setAwardedPoints] = useState<Record<string, number>>(
    {},
  );

  const eventId = params.eventId as string;
  const compId = params.compId as string;

  const evtSvc = new EventService();
  const regSvc = new RegistrationService();
  const matchSvc = new MatchService();
  const standingSvc = new StandingsService();
  const inviteSvc = new ParticipantInviteService();
  const progSvc = new ProgressionService();
  const memberSvc = new MemberService();

  const [isAdmin, setIsAdmin] = useState(false);
  const [canAdvance, setCanAdvance] = useState(false);

  const participantRecipients = async (sourceParticipants = participants) =>
    compactRecipients(
      await Promise.all(
        sourceParticipants.map(async (participant) => {
          const member = await memberSvc.get(participant.memberId);
          return member
            ? { email: member.email, name: member.displayName }
            : null;
        }),
      ),
    );

  const refresh = async () => {
    const e = await evtSvc.get(eventId);
    setEvent(e ?? null);
    if (e) {
      setParticipants(await regSvc.getParticipants(e.id));
      setMatches(await matchSvc.list(e.id));
      const loadedStages = await evtSvc.getStages(e.id);
      setStages(loadedStages);
      setInvites(await inviteSvc.listByEvent(e.id));
      setAllRounds(
        (
          await Promise.all(loadedStages.map((s) => evtSvc.getRounds(s.id)))
        ).flat(),
      );
      setPhasePlan(await progSvc.getProgressionPlan(e.id));
      setProgressionLinks(await progSvc.getProgressionLinks(e.id));
      const storedPoints = await query<{
        id: string;
        eventId: string;
        participantId: string;
        points: number;
      }>("awarded_points", (p: { eventId: string }) => p.eventId === e.id);
      const pointsMap: Record<string, number> = {};
      for (const sp of storedPoints) pointsMap[sp.participantId] = sp.points;
      setAwardedPoints(pointsMap);
      const nextSelectedId =
        loadedStages.length > 0 &&
        (selectedStageId === null ||
          !loadedStages.some((s) => s.id === selectedStageId))
          ? loadedStages[loadedStages.length - 1].id
          : selectedStageId;
      if (loadedStages.length > 0 && nextSelectedId !== selectedStageId) {
        setSelectedStageId(nextSelectedId);
      }
      if (currentMember && currentOrg) {
        setIsAdmin(await canEditMatches(currentMember.id, currentOrg.id));
      }
      if (nextSelectedId) {
        const canAdv =
          loadedStages.some((s) => s.id === nextSelectedId) &&
          (await progSvc.canAdvance(e.id, nextSelectedId)) &&
          (await progSvc.getNextPhaseConfig(
            e.id,
            loadedStages.findIndex((s) => s.id === nextSelectedId),
          )) !== null;
        setCanAdvance(canAdv);
      }
    }
  };

  const regenerateFixturesIfNeeded = async () => {
    const e = await evtSvc.get(eventId);
    if (!e) return;
    const existingStages = await evtSvc.getStages(e.id);
    if (existingStages.length === 0) return;
    if (await evtSvc.hasPlayedMatches(e.id)) return;
    const activeParticipants = await regSvc.getParticipants(e.id);
    if (activeParticipants.length < 2) return;
    await evtSvc.clearEventFixtures(e.id);
    await evtSvc.initializeEvent(e.id, activeParticipants);
  };

  useEffect(() => {
    if (!eventId) return;
    refresh();
  }, [eventId]);

  const handleMatchUpdate = async () => {
    const e = await evtSvc.get(eventId);
    if (!e) return;
    const loadedStages = await evtSvc.getStages(e.id);
    const allRounds = (
      await Promise.all(loadedStages.map((s) => evtSvc.getRounds(s.id)))
    ).flat();
    const allMatches = await matchSvc.list(e.id);

    const stageTypeToFormat: Record<string, FormatType> = {
      round_robin: FormatType.League,
      single_elimination: FormatType.SingleElimination,
      double_elimination: FormatType.DoubleElimination,
      swiss: FormatType.Swiss,
      group_stage: FormatType.GroupStage,
    };

    let propagated = allMatches.map((m) => ({
      ...m,
      participants: [...m.participants],
      participantIds: [...m.participantIds],
    }));
    const seenTypes = new Set<string>();
    for (const stage of loadedStages) {
      if (seenTypes.has(stage.type)) continue;
      seenTypes.add(stage.type);
      const ft = stageTypeToFormat[stage.type];
      if (!ft) continue;
      const stageRoundIds = new Set(
        allRounds.filter((r) => r.stageId === stage.id).map((r) => r.id),
      );
      let stageOnlyMatches = propagated.filter((m) =>
        stageRoundIds.has(m.roundId),
      );
      // Sort by bracket engine order so nextMatchIndex points to the correct match
      stageOnlyMatches = stageOnlyMatches.sort((a, b) => {
        const aIdx = (a.config?.engineMatchIndex as number | undefined) ?? 0;
        const bIdx = (b.config?.engineMatchIndex as number | undefined) ?? 0;
        return aIdx - bIdx;
      });
      const propagatedStage = getFormat(ft).propagateResults(
        stageOnlyMatches,
        allRounds,
      );
      const propMap = new Map(propagatedStage.map((m) => [m.id, m]));
      propagated = propagated.map((m) => propMap.get(m.id) ?? m);
    }
    const originalMap = new Map(allMatches.map((m) => [m.id, m]));
    const changedIds = new Set<string>();
    for (const m of propagated) {
      const orig = originalMap.get(m.id);
      if (!orig) continue;
      // Only update if content actually changed
      const participantsChanged =
        JSON.stringify(m.participants) !== JSON.stringify(orig.participants) ||
        JSON.stringify(m.participantIds) !==
          JSON.stringify(orig.participantIds);
      if (participantsChanged) {
        changedIds.add(m.id);
      }
    }
    for (const m of propagated) {
      if (!changedIds.has(m.id)) continue;
      const { participantIds, participants, result, ...cleanMatch } = m;
      const dbPayload: Record<string, unknown> = { ...cleanMatch };
      await update("matches", m.id, dbPayload);
      await matchSvc.syncParticipants(m);
    }
    refresh();
    if (
      selectedStageId &&
      (await progSvc.canAdvance(e.id, selectedStageId)) &&
      (await progSvc.getNextPhaseConfig(
        e.id,
        stages.findIndex((s) => s.id === selectedStageId),
      ))
    ) {
      try {
        const result = await progSvc.advance(e.id, selectedStageId);
        message.success(`Stage complete! Advanced to: ${result.stage.name}`);
        refresh();
        setSelectedStageId(result.stage.id);
      } catch (err) {
        console.error("Auto-advance failed:", err);
      }
    }
  };

  useEffect(() => {
    if (!event || !selectedStageId) return;
    (async () => {
      const result = await standingSvc.calculate(event.id, selectedStageId);
      setStandings(result);
    })();
  }, [matches, participants, selectedStageId]);

  const handleRegister = async (values: { displayName: string }) => {
    if (!event || !currentMember) return;
    setRegLoading(true);
    try {
      await regSvc.register(event.id, currentMember.id, values.displayName);
      sendMailEvent({
        kind: "participant_registered",
        to: [{ email: currentMember.email, name: currentMember.displayName }],
        actionUrl: `${window.location.origin}/o/${currentOrg?.slug}/competitions/${compId}/events/${event.id}`,
        params: {
          eventName: event.name,
          participantName: values.displayName,
          actionLabel: "Open event",
        },
      });
      message.success("Registered!");
      setRegModalOpen(false);
      await regenerateFixturesIfNeeded();
      refresh();
    } catch {
      message.error("Registration failed");
    } finally {
      setRegLoading(false);
    }
  };

  const handleInitEvent = async () => {
    if (!event) return;
    setInitLoading(true);
    try {
      const activeParticipants = await regSvc.getParticipants(event.id);
      await evtSvc.initializeEvent(event.id, activeParticipants);
      await evtSvc.start(event.id);
      const recipients = await participantRecipients(activeParticipants);
      if (recipients.length > 0) {
        sendMailEvent({
          kind: "event_started",
          to: recipients,
          actionUrl: `${window.location.origin}/o/${currentOrg?.slug}/competitions/${compId}/events/${event.id}`,
          params: {
            eventName: event.name,
            actionLabel: "View event",
          },
        });
        sendMailEvent({
          kind: "bracket_generated",
          to: recipients,
          actionUrl: `${window.location.origin}/o/${currentOrg?.slug}/competitions/${compId}/events/${event.id}`,
          params: {
            eventName: event.name,
            actionLabel: "View fixtures",
          },
        });
      }
      message.success("Event initialized!");
      setInitModalOpen(false);
      refresh();
    } catch (e) {
      message.error("Initialization failed: " + (e as Error).message);
    } finally {
      setInitLoading(false);
    }
  };

  const handleSendInvite = async (values: {
    email: string;
    displayName: string;
  }) => {
    if (!currentMember || !event) return;
    const invite = await inviteSvc.create(
      event.id,
      compId,
      values.email,
      values.displayName,
      currentMember.id,
    );
    sendMailEvent({
      kind: "participant_invite",
      to: [{ email: values.email, name: values.displayName }],
      actionUrl: `${window.location.origin}/invite/participant/${invite.token}`,
      params: {
        eventName: event.name,
        participantName: values.displayName,
        inviterName: currentMember.displayName,
        actionLabel: "Accept invite",
      },
    });
    message.success("Invite sent!");
    setInviteModalOpen(false);
    refresh();
  };

  const handleSeedParticipants = async () => {
    if (!event || !currentMember) return;
    const count = Math.max(1, Math.min(seedCount, 64));
    const firstNames = [
      "Alice",
      "Bob",
      "Charlie",
      "Diana",
      "Eve",
      "Frank",
      "Grace",
      "Hank",
      "Ivy",
      "Jack",
      "Kate",
      "Leo",
      "Mia",
      "Noah",
      "Olivia",
      "Paul",
      "Quinn",
      "Rosa",
      "Sam",
      "Tina",
      "Uma",
      "Vince",
      "Wendy",
      "Xander",
      "Yara",
      "Zack",
      "Aria",
      "Bianca",
      "Carlos",
      "Dora",
      "Eli",
      "Fiona",
      "Gabe",
      "Hazel",
      "Ian",
      "Jade",
      "Kurt",
      "Lia",
      "Miles",
      "Nina",
      "Oscar",
      "Piper",
      "Rico",
      "Sage",
      "Troy",
      "Vera",
      "Wade",
      "Zara",
    ];
    const lastNames = [
      "Smith",
      "Jones",
      "Brown",
      "Lee",
      "Garcia",
      "Kim",
      "Chen",
      "Patel",
      "Davis",
      "Miller",
      "Wilson",
      "Taylor",
      "Anderson",
      "Thomas",
      "Jackson",
      "White",
      "Harris",
      "Martin",
      "Thompson",
      "Moore",
      "Allen",
      "Young",
      "King",
      "Wright",
      "Hill",
      "Scott",
      "Adams",
      "Baker",
      "Carter",
      "Evans",
    ];
    for (let i = 1; i <= count; i++) {
      const first = firstNames[Math.floor(Math.random() * firstNames.length)];
      const last = lastNames[Math.floor(Math.random() * lastNames.length)];
      await regSvc.register(event.id, currentMember.id, `${first} ${last}`);
    }
    message.success(`${count} test participants added!`);
    setSeedModalOpen(false);
    await regenerateFixturesIfNeeded();
    refresh();
  };

  const handleStartEvent = () => {
    setInitModalOpen(true);
  };

  const handleCompleteEvent = async () => {
    if (!event) return;
    await evtSvc.complete(event.id);
    const recipients = await participantRecipients();
    if (recipients.length > 0) {
      sendMailEvent({
        kind: "event_completed",
        to: recipients,
        actionUrl: `${window.location.origin}/o/${currentOrg?.slug}/competitions/${compId}/events/${event.id}`,
        params: {
          eventName: event.name,
          actionLabel: "View results",
        },
      });
      sendMailEvent({
        kind: "standings_updated",
        to: recipients,
        actionUrl: `${window.location.origin}/o/${currentOrg?.slug}/competitions/${compId}/events/${event.id}`,
        params: {
          eventName: event.name,
          actionLabel: "View standings",
        },
      });
    }
    refresh();
    message.success("Event completed!");
  };

  const handleGenerateSwissRound = async () => {
    if (!event || !selectedStageId) return;
    setSwissGenerating(true);
    try {
      await evtSvc.generateSwissRound(event.id, selectedStageId);
      const recipients = await participantRecipients();
      if (recipients.length > 0) {
        sendMailEvent({
          kind: "bracket_generated",
          to: recipients,
          actionUrl: `${window.location.origin}/o/${currentOrg?.slug}/competitions/${compId}/events/${event.id}`,
          params: {
            eventName: event.name,
            actionLabel: "View new round",
          },
        });
      }
      message.success("Next round generated!");
      refresh();
    } catch (e) {
      message.error("Failed to generate round: " + (e as Error).message);
    } finally {
      setSwissGenerating(false);
    }
  };

  const handleAdvance = async () => {
    if (!event || !selectedStageId) return;
    setAdvancing(true);
    try {
      const result = await progSvc.advance(event.id, selectedStageId);
      message.success(`Advanced to: ${result.stage.name}`);
      refresh();
      setSelectedStageId(result.stage.id);
    } catch (e) {
      message.error("Failed to advance: " + (e as Error).message);
    } finally {
      setAdvancing(false);
    }
  };

  const handleAddPhase = async () => {
    if (!event) return;
    const current = await progSvc.getProgressionPlan(event.id);
    const phases = current?.phases ?? [];
    phases.push({ format: newPhaseFormat, qualifierCount: newPhaseQualifiers });
    await progSvc.saveProgressionPlan(event.id, { phases });
    setPhasePlan({ phases });
    setPhaseModalOpen(false);
    message.success("Phase added!");
  };

  const handleUpdatePhase = async (
    idx: number,
    updates: Partial<PhaseConfig>,
  ) => {
    if (!event || !phasePlan) return;
    const phases = [...phasePlan.phases];
    phases[idx] = { ...phases[idx], ...updates };
    await progSvc.saveProgressionPlan(event.id, { phases });
    setPhasePlan({ phases });
  };

  const handleRemovePhase = async (idx: number) => {
    if (!event || !phasePlan) return;
    const phases = phasePlan.phases.filter((_, i) => i !== idx);
    await progSvc.saveProgressionPlan(event.id, { phases });
    setPhasePlan(phases.length > 0 ? { phases } : null);
  };

  const handleSaveAwardedPoints = async () => {
    if (!event) return;
    const existing = await query<{
      id: string;
      eventId: string;
      participantId: string;
      points: number;
    }>("awarded_points", (p: { eventId: string }) => p.eventId === event.id);
    for (const item of existing) {
      await Delete("awarded_points", item.id);
    }
    for (const [participantId, points] of Object.entries(awardedPoints)) {
      if (points > 0) {
        await create("awarded_points", {
          id: participantId,
          eventId: event.id,
          participantId,
          points,
        });
      }
    }
    message.success("Points saved!");
  };

  const handleDeleteEvent = async () => {
    if (!event) return;
    await evtSvc.Delete(event.id);
    message.success("Event deleted");
    router.push(`/o/${currentOrg!.slug}/competitions/${compId}`);
  };

  const selectedStageRounds = useMemo(() => {
    if (!selectedStageId) return allRounds;
    return allRounds.filter((r) => {
      const stage = stages.find((s) => s.id === selectedStageId);
      return stage && r.stageId === stage.id;
    });
  }, [selectedStageId, allRounds, stages]);

  const selectedStageMatches = useMemo(() => {
    if (!selectedStageId) return matches;
    const stageRoundIds = new Set(selectedStageRounds.map((r) => r.id));
    return matches.filter((m) => stageRoundIds.has(m.roundId));
  }, [selectedStageId, selectedStageRounds, matches]);

  const sortedStageMatches = useMemo(() => {
    const base = selectedStageMatches;
    const roundOrder = new Map<number, number>();
    selectedStageRounds.forEach((r, idx) =>
      roundOrder.set(r.roundNumber ?? idx, idx),
    );
    return [...base].sort((a, b) => {
      const aRound = a.roundId
        ? (roundOrder.get(
            selectedStageRounds.find((r) => r.id === a.roundId)?.roundNumber ??
              0,
          ) ?? 0)
        : 0;
      const bRound = b.roundId
        ? (roundOrder.get(
            selectedStageRounds.find((r) => r.id === b.roundId)?.roundNumber ??
              0,
          ) ?? 0)
        : 0;
      if (aRound !== bRound) return aRound - bRound;
      return a.participants.length - b.participants.length;
    });
  }, [selectedStageMatches, selectedStageRounds]);

  const groupNames = useMemo(() => {
    if (!event || stages.length === 0) return [];
    const isGS = event.format === FormatType.GroupStage;
    if (!isGS) return [];
    const groups = stages[0].config?.groups as string[][] | undefined;
    if (!groups) return [];
    return groups.map((_, i) => String.fromCharCode(65 + i));
  }, [event, stages]);

  const filteredStandings = useMemo(() => {
    if (!event) return standings;
    const isGS = event.format === FormatType.GroupStage;
    if (!isGS || selectedGroupIndex === null) return standings;
    return standings.filter((s) => s.stats?.groupIndex === selectedGroupIndex);
  }, [standings, event, selectedGroupIndex]);

  const groupMatches = useMemo(() => {
    if (!event) return matches;
    const isGS = event.format === FormatType.GroupStage;
    if (!isGS || selectedGroupIndex === null) return matches;
    return matches.filter(
      (m) => (m.config?.groupIndex as number) === selectedGroupIndex,
    );
  }, [matches, event, selectedGroupIndex]);

  const stageCompletion = useMemo(() => {
    const result: Record<string, { total: number; completed: number }> = {};
    for (const stage of stages) {
      const roundIds = allRounds
        .filter((r) => r.stageId === stage.id)
        .map((r) => r.id);
      const stageMatches = matches.filter((m) => roundIds.includes(m.roundId));
      result[stage.id] = {
        total: stageMatches.length,
        completed: stageMatches.filter(
          (m) =>
            m.status === MatchStatus.Completed ||
            m.status === MatchStatus.Walkover,
        ).length,
      };
    }
    return result;
  }, [stages, allRounds, matches]);

  const linkMap = useMemo(() => {
    const result: Record<string, ProgressionLink> = {};
    for (const link of progressionLinks) {
      result[link.sourceStageId] = link;
    }
    return result;
  }, [progressionLinks]);

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

  const playableMatches = useMemo(
    () => sortedStageMatches.filter((m) => m.status !== MatchStatus.Walkover),
    [sortedStageMatches],
  );

  if (!currentOrg || !event) return null;

  const isInitialized = stages.length > 0;
  const selectedStage = stages.find((s) => s.id === selectedStageId) ?? null;
  const isKnockout =
    event.format === FormatType.SingleElimination ||
    event.format === FormatType.DoubleElimination;
  const isSwiss = event.format === FormatType.Swiss;
  const isGroupStage = event.format === FormatType.GroupStage;
  const showStandings = !isGroupStage;
  const showBracket = isKnockout || bracketStage !== null;

  const completedRoundNumbers = new Set(
    selectedStageMatches
      .filter(
        (m) =>
          m.status === MatchStatus.Completed ||
          m.status === MatchStatus.Walkover,
      )
      .map(
        (m) => selectedStageRounds.find((r) => r.id === m.roundId)?.roundNumber,
      )
      .filter((n): n is number => n !== undefined),
  );
  const currentSwissRound = Math.max(0, ...completedRoundNumbers) + 1;
  const maxSwissRound = selectedStageRounds.length;
  const isSwissRoundComplete =
    isSwiss &&
    selectedStageMatches.length > 0 &&
    selectedStageMatches.every((m) => {
      const rn = selectedStageRounds.find(
        (r) => r.id === m.roundId,
      )?.roundNumber;
      return (
        rn !== currentSwissRound ||
        m.status === MatchStatus.Completed ||
        m.status === MatchStatus.Walkover
      );
    });
  const canGenerateSwissRound =
    isSwiss &&
    isInitialized &&
    isSwissRoundComplete &&
    currentSwissRound <= maxSwissRound;

  const overviewTab = (
    <div>
      <Descriptions
        bordered
        size="small"
        column={2}
        style={{ marginBottom: 16 }}
      >
        <Descriptions.Item label="Format">
          <Tag>{event.format}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <Tag
            color={
              event.status === EventStatus.InProgress
                ? "green"
                : event.status === EventStatus.Completed
                  ? "purple"
                  : "default"
            }
          >
            {event.status}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Participants">
          {participants.length}
        </Descriptions.Item>
        <Descriptions.Item label="Matches">{matches.length}</Descriptions.Item>
        <Descriptions.Item label="Registration">
          {event.registrationPolicy}
        </Descriptions.Item>
        <Descriptions.Item label="Participant Type">
          {event.participantType}
        </Descriptions.Item>
      </Descriptions>

      {!isInitialized ? (
        <Card>
          <Space
            direction="vertical"
            style={{ width: "100%", textAlign: "center", padding: 24 }}
          >
            <Title level={4}>Event Not Initialized</Title>
            <Text>
              Register participants first, then initialize to generate fixtures.
            </Text>
            <Space>
              <Button
                type="primary"
                icon={<TeamOutlined />}
                onClick={() => setRegModalOpen(true)}
              >
                Register Me
              </Button>
              <Button
                icon={<PlayCircleOutlined />}
                onClick={handleStartEvent}
                disabled={participants.length < 2}
              >
                Initialize Event
              </Button>
            </Space>
          </Space>
        </Card>
      ) : (
        <div>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={12} lg={6}>
              <Card
                className="animate-fade-in-up delay-1 stat-card"
                style={{
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background:
                    "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
                  transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    className="stat-icon"
                    style={{
                      fontSize: 40,
                      marginBottom: 12,
                      background: "linear-gradient(135deg, #3b82f6, #1e3a8a)",
                      borderRadius: 14,
                      padding: 14,
                      display: "inline-flex",
                      boxShadow: "0 10px 25px rgba(59, 130, 246, 0.3)",
                    }}
                  >
                    <TeamOutlined style={{ color: "#fff", fontSize: 24 }} />
                  </div>
                  <Statistic
                    title="PARTICIPANTS"
                    value={participants.length}
                    valueStyle={{
                      fontSize: 36,
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #1e3a8a, #3b82f6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-0.02em",
                    }}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={12} lg={6}>
              <Card
                className="animate-fade-in-up delay-2 stat-card"
                style={{
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background:
                    "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
                  transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    className="stat-icon"
                    style={{
                      fontSize: 40,
                      marginBottom: 12,
                      background: "linear-gradient(135deg, #f59e0b, #d97706)",
                      borderRadius: 14,
                      padding: 14,
                      display: "inline-flex",
                      boxShadow: "0 10px 25px rgba(245, 158, 11, 0.3)",
                    }}
                  >
                    <ScheduleOutlined style={{ color: "#fff", fontSize: 24 }} />
                  </div>
                  <Statistic
                    title="MATCHES"
                    value={matches.length}
                    valueStyle={{
                      fontSize: 36,
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #d97706, #f59e0b)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-0.02em",
                    }}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={12} lg={6}>
              <Card
                className="animate-fade-in-up delay-3 stat-card"
                style={{
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background:
                    "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
                  transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    className="stat-icon"
                    style={{
                      fontSize: 40,
                      marginBottom: 12,
                      background: "linear-gradient(135deg, #22c55e, #16a34a)",
                      borderRadius: 14,
                      padding: 14,
                      display: "inline-flex",
                      boxShadow: "0 10px 25px rgba(34, 197, 94, 0.3)",
                    }}
                  >
                    <TrophyOutlined style={{ color: "#fff", fontSize: 24 }} />
                  </div>
                  <Statistic
                    title="COMPLETED"
                    value={
                      matches.filter((m) => m.status === MatchStatus.Completed)
                        .length
                    }
                    valueStyle={{
                      fontSize: 36,
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #16a34a, #22c55e)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-0.02em",
                    }}
                  />
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={12} lg={6}>
              <Card
                className="animate-fade-in-up delay-4 stat-card"
                style={{
                  borderRadius: 20,
                  border: "1px solid #e2e8f0",
                  background:
                    "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  boxShadow:
                    "0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.01)",
                  transition: "all 0.4s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    className="stat-icon"
                    style={{
                      fontSize: 40,
                      marginBottom: 12,
                      background: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
                      borderRadius: 14,
                      padding: 14,
                      display: "inline-flex",
                      boxShadow: "0 10px 25px rgba(139, 92, 246, 0.3)",
                    }}
                  >
                    <NodeIndexOutlined
                      style={{ color: "#fff", fontSize: 24 }}
                    />
                  </div>
                  <Statistic
                    title="STAGES"
                    value={stages.length}
                    valueStyle={{
                      fontSize: 36,
                      fontWeight: 800,
                      background: "linear-gradient(135deg, #7c3aed, #8b5cf6)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      letterSpacing: "-0.02em",
                    }}
                  />
                </div>
              </Card>
            </Col>
          </Row>

          {isSwiss && (
            <Card style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: "100%" }}>
                <SwissRoundStatus
                  stages={stages}
                  allRounds={selectedStageRounds}
                  matches={selectedStageMatches}
                />
                <Divider style={{ margin: "12px 0" }} />
                <Space>
                  <Text strong>
                    Round {currentSwissRound} of {maxSwissRound}
                  </Text>
                  {canGenerateSwissRound &&
                    currentSwissRound <= maxSwissRound && (
                      <Button
                        type="primary"
                        icon={<ForwardOutlined />}
                        loading={swissGenerating}
                        onClick={handleGenerateSwissRound}
                      >
                        Generate Round {currentSwissRound}
                      </Button>
                    )}
                  {currentSwissRound > maxSwissRound && (
                    <Tag color="green">All rounds complete</Tag>
                  )}
                </Space>
              </Space>
            </Card>
          )}

          {canAdvance && (
            <Card style={{ marginTop: 16 }}>
              <Space
                direction="vertical"
                style={{ width: "100%", textAlign: "center", padding: 12 }}
              >
                <Text strong>Stage Complete — Ready to Advance</Text>
                <Text type="secondary">
                  All matches in this stage are finished. Advance qualifiers to
                  the next phase.
                </Text>
                <Button
                  type="primary"
                  size="large"
                  icon={<ForwardOutlined />}
                  loading={advancing}
                  onClick={handleAdvance}
                >
                  Advance to Next Phase
                </Button>
              </Space>
            </Card>
          )}

          {isInitialized && participants.length > 0 && (
            <Card style={{ marginTop: 16 }} title="Award Points">
              <Text
                type="secondary"
                style={{ display: "block", marginBottom: 12 }}
              >
                Manually assign placement points to participants (e.g., 1st: 10,
                2nd: 6, 3rd: 3, 4th: 2).
              </Text>
              <Table
                dataSource={participants}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: "Participant",
                    dataIndex: "displayName",
                    key: "displayName",
                  },
                  {
                    title: "Points",
                    key: "points",
                    width: 120,
                    render: (_: unknown, record: Participant) => (
                      <InputNumber
                        value={awardedPoints[record.id] ?? 0}
                        onChange={(v) =>
                          setAwardedPoints((prev) => ({
                            ...prev,
                            [record.id]: v ?? 0,
                          }))
                        }
                        min={0}
                        style={{ width: 100 }}
                      />
                    ),
                  },
                ]}
                summary={() => (
                  <Table.Summary fixed>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0}>
                        <Text strong>Total</Text>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        <Text strong>
                          {Object.values(awardedPoints).reduce(
                            (a, b) => a + b,
                            0,
                          )}
                        </Text>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveAwardedPoints}
                style={{ marginTop: 12 }}
              >
                Save Points
              </Button>
            </Card>
          )}

          {isGroupStage && stages.length > 0 && (
            <Card style={{ marginTop: 16 }} title="Group Overview">
              <Row gutter={[16, 16]}>
                {(stages[0].config?.groups as string[][] | undefined)?.map(
                  (group, idx) => {
                    const groupName = String.fromCharCode(65 + idx);
                    const groupPids = group.filter((pid) =>
                      participants.some((p) => p.id === pid),
                    );
                    const groupStandings = standings.filter(
                      (s) => s.stats?.groupIndex === idx,
                    );
                    return (
                      <Col key={idx} span={6}>
                        <Card
                          size="small"
                          title={`Group ${groupName}`}
                          extra={<Tag>{groupPids.length} players</Tag>}
                        >
                          {groupStandings.slice(0, 3).map((entry, rank) => (
                            <div
                              key={entry.participantId}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: 4,
                              }}
                            >
                              <Text style={{ fontSize: 13 }}>
                                {rank === 0 && "🥇"} {rank === 1 && "🥈"}{" "}
                                {rank === 2 && "🥉"} {entry.displayName}
                              </Text>
                              <Text style={{ fontSize: 13 }}>
                                {entry.points} pts
                              </Text>
                            </div>
                          ))}
                        </Card>
                      </Col>
                    );
                  },
                )}
              </Row>
            </Card>
          )}
        </div>
      )}
    </div>
  );

  const matchesTab = isGroupStage ? (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type={selectedGroupIndex === null ? "primary" : "default"}
            onClick={() => setSelectedGroupIndex(null)}
          >
            All Groups
          </Button>
          {groupNames.map((name, idx) => (
            <Button
              key={idx}
              type={selectedGroupIndex === idx ? "primary" : "default"}
              onClick={() => setSelectedGroupIndex(idx)}
            >
              Group {name}
            </Button>
          ))}
        </Space>
      </div>
      <MatchListView
        matches={groupMatches}
        participants={participants}
        eventId={event.id}
        eventFormat={event.format}
        onMatchUpdate={handleMatchUpdate}
        isAdmin={isAdmin}
      />
      {event && !isGroupStage && (
        <AiInsights
          matches={groupMatches}
          participants={participants}
          eventName={event.name}
          autoAnalyze
        />
      )}
    </div>
  ) : (
    <>
      <MatchListView
        matches={playableMatches}
        participants={participants}
        eventId={event.id}
        eventFormat={event.format}
        onMatchUpdate={handleMatchUpdate}
        isAdmin={isAdmin}
      />
      {event && (
        <AiInsights
          matches={selectedStageMatches}
          participants={participants}
          eventName={event.name}
          autoAnalyze
        />
      )}
    </>
  );

  const standingsTab = isGroupStage ? (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type={selectedGroupIndex === null ? "primary" : "default"}
            onClick={() => setSelectedGroupIndex(null)}
          >
            All Groups
          </Button>
          {groupNames.map((name, idx) => (
            <Button
              key={idx}
              type={selectedGroupIndex === idx ? "primary" : "default"}
              onClick={() => setSelectedGroupIndex(idx)}
            >
              Group {name}
            </Button>
          ))}
        </Space>
      </div>
      <StandingsTable standings={filteredStandings} event={event} />
    </div>
  ) : (
    <StandingsTable standings={standings} event={event} />
  );

  const tabItems = [
    { key: "overview", label: "Overview", children: overviewTab },
    {
      key: "participants",
      label: `Participants (${participants.length})`,
      children: (
        <div>
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setRegModalOpen(true)}
              >
                Register Me
              </Button>
              <Button
                icon={<LinkOutlined />}
                onClick={() => setInviteModalOpen(true)}
              >
                Send Invites
              </Button>
              <Button
                icon={<BugOutlined />}
                onClick={() => setSeedModalOpen(true)}
              >
                Seed Test
              </Button>
              <Button onClick={refresh}>Refresh</Button>
            </Space>
          </div>
          <Table
            dataSource={participants}
            rowKey="id"
            pagination={false}
            columns={[
              { title: "Name", dataIndex: "displayName", key: "displayName" },
              {
                title: "Seed",
                dataIndex: "seed",
                key: "seed",
                render: (s: number | undefined) => s ?? "-",
              },
              {
                title: "Status",
                dataIndex: "status",
                key: "status",
                render: (s: string) => (
                  <Tag
                    color={
                      s === "active"
                        ? "green"
                        : s === "eliminated"
                          ? "red"
                          : "orange"
                    }
                  >
                    {s}
                  </Tag>
                ),
              },
              {
                title: "Registered",
                dataIndex: "registeredAt",
                key: "registeredAt",
                render: (d: string) => new Date(d).toLocaleDateString(),
              },
              {
                title: "Actions",
                key: "actions",
                render: (_: unknown, record: Participant) => (
                  <Button
                    size="small"
                    danger
                    onClick={async () => {
                      await regSvc.dropOut(record.id);
                      await regenerateFixturesIfNeeded();
                      refresh();
                    }}
                  >
                    Drop Out
                  </Button>
                ),
              },
            ]}
          />
          {invites.filter((i) => i.status === "pending").length > 0 && (
            <div style={{ marginTop: 24 }}>
              <Title level={5} style={{ marginBottom: 12 }}>
                Pending Invites
              </Title>
              <Table
                dataSource={invites.filter((i) => i.status === "pending")}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: "Name",
                    dataIndex: "displayName",
                    key: "displayName",
                  },
                  { title: "Email", dataIndex: "email", key: "email" },
                  {
                    title: "Invite Link",
                    key: "link",
                    render: (_: unknown, record: ParticipantInvite) => {
                      const link = `${window.location.origin}/invite/participant/${record.token}`;
                      return (
                        <Text
                          copyable={{
                            text: link,
                            icon: [
                              <CopyOutlined key="c" />,
                              <CopyOutlined key="d" />,
                            ],
                          }}
                          style={{ fontSize: 13 }}
                        >
                          {link}
                        </Text>
                      );
                    },
                  },
                  {
                    title: "Actions",
                    key: "actions",
                    render: (_: unknown, record: ParticipantInvite) => (
                      <Button
                        size="small"
                        danger
                        icon={<StopOutlined />}
                        onClick={async () => {
                          await inviteSvc.revoke(record.id);
                          refresh();
                        }}
                      >
                        Revoke
                      </Button>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "matches",
      label: `Matches (${matches.length})`,
      children: matchesTab,
    },
    ...(showStandings
      ? [
          {
            key: "standings",
            label: "Standings",
            children: standingsTab,
          },
        ]
      : []),
    ...(showBracket
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
    {
      key: "settings",
      label: "Settings",
      children: (
        <div>
          <EventSettings event={event} evtSvc={evtSvc} />
          <Divider />
          <Title level={5}>Phase Progression</Title>
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            Configure subsequent phases after the initial {event.format} stage.
            Qualifiers advance automatically.
          </Text>
          {phasePlan && phasePlan.phases.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {phasePlan.phases.map((p, i) => (
                <Card key={i} size="small" style={{ background: "#fafafa" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <Tag color="blue">Phase {i + 2}</Tag>
                    <Select
                      size="small"
                      value={p.format}
                      onChange={(v) =>
                        handleUpdatePhase(i, {
                          format: v,
                          qualifierCount: autoQualifierCount(
                            participants.length,
                            v,
                          ),
                        })
                      }
                      style={{ width: 160 }}
                      options={[
                        {
                          value: FormatType.SingleElimination,
                          label: "Single Elimination",
                        },
                        {
                          value: FormatType.DoubleElimination,
                          label: "Double Elimination",
                        },
                        { value: FormatType.League, label: "League" },
                        { value: FormatType.Swiss, label: "Swiss" },
                      ]}
                    />
                    <span style={{ fontSize: 13, color: "#666" }}>
                      qualifiers:
                    </span>
                    <InputNumber
                      size="small"
                      min={2}
                      max={64}
                      value={p.qualifierCount}
                      onChange={(v) =>
                        handleUpdatePhase(i, { qualifierCount: v ?? 2 })
                      }
                      style={{ width: 72 }}
                    />
                    <Popconfirm
                      title="Remove this phase?"
                      onConfirm={() => handleRemovePhase(i)}
                      okText="Remove"
                      okButtonProps={{ danger: true }}
                    >
                      <Button size="small" danger icon={<CloseOutlined />} />
                    </Popconfirm>
                  </div>
                </Card>
              ))}
            </div>
          )}
          <Button
            icon={<PlusOutlined />}
            onClick={() => setPhaseModalOpen(true)}
          >
            Add Phase
          </Button>
          <Divider />
          <div
            style={{
              border: "1px solid #ff4d4f",
              borderRadius: 12,
              padding: 24,
              marginTop: 24,
            }}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              <Title level={5} style={{ color: "#ff4d4f", margin: 0 }}>
                Danger Zone
              </Title>
              <Text type="secondary">
                Once you delete an event, there is no going back. Please be
                certain.
              </Text>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={() => {
                  setDeleteConfirmText("");
                  setDeleteModalOpen(true);
                }}
              >
                Delete this Event
              </Button>
            </Space>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {event.coverImage && (
          <img
            src={event.coverImage}
            alt="Event cover"
            style={{
              width: "100%",
              maxHeight: 300,
              objectFit: "cover",
              borderRadius: 12,
              marginBottom: 12,
            }}
          />
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Title level={3} style={{ margin: 0 }}>
              {event.name}
            </Title>
            <ImageUpload
              currentUrl={event.coverImage}
              onUpload={async (url) => {
                if (!currentMember) return;
                const svc = new EventService();
                await svc.update(
                  event.id,
                  { coverImage: url },
                  currentMember.id,
                );
                message.success("Cover image updated");
                refresh();
              }}
            />
          </div>
          <Space>
            <Text type="secondary">{event.format}</Text>
            <Tag
              color={
                event.status === EventStatus.InProgress
                  ? "green"
                  : event.status === EventStatus.Completed
                    ? "purple"
                    : "default"
              }
            >
              {event.status}
            </Tag>
          </Space>
        </div>
        <Space>
          {!isInitialized && (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStartEvent}
              disabled={participants.length < 2}
            >
              Initialize & Start
            </Button>
          )}
          {isInitialized && event.status === EventStatus.InProgress && (
            <Button onClick={handleCompleteEvent}>Complete Event</Button>
          )}
        </Space>
      </div>

      {stages.length > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 0,
            marginBottom: 16,
            overflow: "auto",
          }}
        >
          {stages.map((stage, idx) => {
            const sc = stageCompletion[stage.id] ?? { total: 0, completed: 0 };
            const link = linkMap[stage.id];
            const isActive = selectedStageId === stage.id;
            const isComplete =
              sc.total > 0 &&
              sc.completed === sc.total &&
              (link !== undefined || idx === stages.length - 1);
            const isDoubleElimLosers =
              event.format === FormatType.DoubleElimination &&
              stage.config?.bracketType === BracketGroup.Losers;
            const isLocked =
              !isDoubleElimLosers && idx > 0 && !linkMap[stages[idx - 1]?.id];
            return (
              <div
                key={stage.id}
                style={{ display: "flex", alignItems: "stretch" }}
              >
                {idx > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      alignItems: "center",
                      padding: "0 4px",
                      minWidth: 40,
                    }}
                  >
                    <RightOutlined
                      style={{
                        fontSize: 16,
                        color: link ? "#1E3A8A" : "#d9d9d9",
                      }}
                    />
                    {link && (
                      <Text
                        style={{
                          fontSize: 10,
                          color: "#64748B",
                          whiteSpace: "nowrap",
                          marginTop: 2,
                        }}
                      >
                        top {link.qualifierCount}
                      </Text>
                    )}
                  </div>
                )}
                <Card
                  size="small"
                  hoverable
                  style={{
                    borderRadius: 10,
                    cursor: "pointer",
                    minWidth: 140,
                    border: isActive
                      ? "2px solid #1E3A8A"
                      : isLocked
                        ? "1px solid #e5e7eb"
                        : "1px solid #E2E8F0",
                    background: isActive
                      ? "rgba(30, 58, 138, 0.04)"
                      : isLocked
                        ? "#f9fafb"
                        : "#fff",
                    opacity: isLocked ? 0.5 : 1,
                  }}
                  onClick={() => !isLocked && setSelectedStageId(stage.id)}
                >
                  <div style={{ textAlign: "center" }}>
                    <Text strong style={{ fontSize: 13, display: "block" }}>
                      {stage.name}
                    </Text>
                    <div style={{ marginTop: 4 }}>
                      {isLocked ? (
                        <Tag
                          icon={<LockOutlined />}
                          color="default"
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          Locked
                        </Tag>
                      ) : isComplete ? (
                        <Tag
                          icon={<CheckCircleFilled />}
                          color="success"
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          Complete
                        </Tag>
                      ) : isActive ? (
                        <Tag
                          color="processing"
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          Active
                        </Tag>
                      ) : (
                        <Tag
                          color="default"
                          style={{ fontSize: 10, margin: 0 }}
                        >
                          In Progress
                        </Tag>
                      )}
                    </div>
                    {sc.total > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 11, color: "#64748B" }}>
                          {sc.completed}/{sc.total} done
                        </Text>
                      </div>
                    )}
                    {link && (
                      <div style={{ marginTop: 4 }}>
                        <Text style={{ fontSize: 10, color: "#3b82f6" }}>
                          → {link.qualifierCount} advanced
                        </Text>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      <Tabs
        items={tabItems}
        tabBarStyle={{ overflowX: "auto", whiteSpace: "nowrap" }}
      />

      <Modal
        title="Register Participant"
        open={regModalOpen}
        onCancel={() => setRegModalOpen(false)}
        footer={null}
      >
        <Form layout="vertical" onFinish={handleRegister}>
          <Form.Item
            label="Display Name"
            name="displayName"
            rules={[{ required: true }]}
          >
            <Input placeholder="Your name or username" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={regLoading}>
              Register
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Send Participant Invite"
        open={inviteModalOpen}
        onCancel={() => setInviteModalOpen(false)}
        footer={null}
      >
        <Form
          layout="vertical"
          onFinish={handleSendInvite}
          requiredMark={false}
        >
          <Form.Item
            label="Email"
            name="email"
            rules={[
              {
                required: true,
                type: "email",
                message: "Valid email required",
              },
            ]}
          >
            <Input placeholder="player@example.com" size="large" />
          </Form.Item>
          <Form.Item
            label="Display Name"
            name="displayName"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="Their name or team name" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" size="large" block>
              Send Invite
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Seed Test Participants"
        open={seedModalOpen}
        onCancel={() => setSeedModalOpen(false)}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            This will add N test participants (Player 1, Player 2, ... Player
            N). Existing participants are preserved.
          </Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Text strong>Number of players:</Text>
          <InputNumber
            min={1}
            max={64}
            value={seedCount}
            onChange={(v) => setSeedCount(v ?? 8)}
            style={{ width: "100%", marginTop: 8 }}
          />
        </div>
        <Button
          type="primary"
          size="large"
          block
          onClick={handleSeedParticipants}
        >
          Seed {seedCount} Players
        </Button>
      </Modal>

      <Modal
        title="Initialize Event"
        open={initModalOpen}
        onCancel={() => setInitModalOpen(false)}
        footer={null}
      >
        <p>
          This will generate fixtures/brackets for {participants.length}{" "}
          participants. Continue?
        </p>
        <Space>
          <Button
            type="primary"
            loading={initLoading}
            onClick={handleInitEvent}
          >
            Initialize
          </Button>
          <Button onClick={() => setInitModalOpen(false)}>Cancel</Button>
        </Space>
      </Modal>

      <Modal
        title="Add Phase"
        open={phaseModalOpen}
        onCancel={() => setPhaseModalOpen(false)}
        afterOpenChange={(open) => {
          if (open)
            setNewPhaseQualifiers(
              autoQualifierCount(participants.length, newPhaseFormat),
            );
        }}
        footer={null}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            Configure the next phase after the current stage completes. You can
            change this later.
          </Text>
        </div>
        <Form layout="vertical">
          <Form.Item label="Format" required>
            <Select
              value={newPhaseFormat}
              onChange={(v) => {
                setNewPhaseFormat(v);
                setNewPhaseQualifiers(
                  autoQualifierCount(participants.length, v),
                );
              }}
              options={[
                {
                  value: FormatType.SingleElimination,
                  label: "Single Elimination",
                },
                {
                  value: FormatType.DoubleElimination,
                  label: "Double Elimination",
                },
                { value: FormatType.League, label: "League" },
                { value: FormatType.Swiss, label: "Swiss" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Qualifiers from Previous Stage" required>
            <InputNumber
              min={2}
              max={64}
              value={newPhaseQualifiers}
              onChange={(v) => setNewPhaseQualifiers(v ?? 2)}
              style={{ width: "100%" }}
            />
            <Text
              type="secondary"
              style={{ fontSize: 12, display: "block", marginTop: 4 }}
            >
              Auto-calculated based on {participants.length} registered
              participants. Adjust as needed.
            </Text>
          </Form.Item>
          <Form.Item>
            <Button type="primary" block onClick={handleAddPhase}>
              Add Phase
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <span>
            <ExclamationCircleOutlined
              style={{ color: "#ff4d4f", marginRight: 8 }}
            />
            Delete Event
          </span>
        }
        open={deleteModalOpen}
        onCancel={() => setDeleteModalOpen(false)}
        okText="Delete this event"
        okButtonProps={{
          danger: true,
          disabled: deleteConfirmText !== event?.name,
        }}
        onOk={handleDeleteEvent}
      >
        <div style={{ marginBottom: 16 }}>
          <Text>
            This action cannot be undone. This will permanently delete the event
            and all associated data (matches, standings, stages, registrations).
          </Text>
        </div>
        <div style={{ marginBottom: 8 }}>
          <Text strong>
            Please type <Text code>{event?.name}</Text> to confirm:
          </Text>
        </div>
        <Input
          value={deleteConfirmText}
          onChange={(e) => setDeleteConfirmText(e.target.value)}
          placeholder={event?.name}
          onPressEnter={() => {
            if (deleteConfirmText === event?.name) handleDeleteEvent();
          }}
        />
      </Modal>
    </div>
  );
}
