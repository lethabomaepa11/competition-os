import { notFound } from "next/navigation";
import { BracketView } from "@/components/bracket/bracket-view";
import { DoubleEliminationFormat } from "@/domain/formats/double-elimination";
import { GroupStageFormat } from "@/domain/formats/group-stage";
import { createGroupStageBracketPreview } from "@/domain/formats/group-stage-preview";
import type { Event } from "@/domain/event";
import type { Participant } from "@/domain/participant";
import type { StandingsEntry } from "@/domain/formats/interface";
import { EventStatus, FormatType, ParticipantType, RegistrationPolicy } from "@/domain/types";
import styles from "./bracket-preview.module.css";

export default function BracketPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  const participants: Participant[] = Array.from({ length: 12 }, (_, index) => ({
    id: `sample-${index + 1}`,
    eventId: "preview-event",
    memberId: `member-${index + 1}`,
    displayName: ["Cape Town City", "Mamelodi Sundowns", "Orlando Pirates", "Kaizer Chiefs", "Stellenbosch FC", "TS Galaxy", "SuperSport United", "Sekhukhune United", "AmaZulu FC", "Golden Arrows", "Chippa United", "Polokwane City"][index],
    seed: index + 1,
    status: "active",
    registeredAt: "2026-10-14T00:00:00.000Z",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
  }));
  const rules = [
    { key: "group_count", value: 4 },
    { key: "qualifiers_per_group", value: 2 },
    { key: "seeding", value: true },
  ];
  const [groupStage] = new GroupStageFormat().createStages("preview-event", participants, rules);
  const groups = groupStage.stage.config.groups as string[][];
  const standings: StandingsEntry[] = groups.flatMap((group, groupIndex) => group.map((participantId, index) => ({
    participantId,
    displayName: participants.find((participant) => participant.id === participantId)?.displayName ?? participantId,
    rank: index + 1,
    points: 7 - index * 3,
    wins: 2 - index,
    losses: index,
    draws: 0,
    stats: { groupIndex },
    qualified: index < 2,
    qualificationStatus: index < 2 ? "projected" as const : "outside" as const,
    groupName: `Group ${String.fromCharCode(65 + groupIndex)}`,
  }))).reverse();
  const event: Event = {
    id: "preview-event",
    competitionId: "preview-competition",
    name: "Continental Cup",
    format: FormatType.GroupStage,
    participantType: ParticipantType.Team,
    status: EventStatus.InProgress,
    registrationPolicy: RegistrationPolicy.ApprovalRequired,
    config: {},
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
  };
  const preview = createGroupStageBracketPreview(event, groupStage.stage, standings, participants, rules, FormatType.SingleElimination);
  const doubleElimination = new DoubleEliminationFormat().createStages("double-preview", participants.slice(0, 8), rules)[0];

  if (!preview) return notFound();

  return <main className={styles.page}>
    <header className={styles.header}><div><span>CompetitionOS / Bracket system</span><h1>Projected knockout draw</h1><p>Four groups, three teams in each. Only the top two in each group enter this eight-team bracket.</p></div><div className={styles.counter} data-testid="qualifier-counter"><b>{preview.participantIds.length}<i>/</i>12</b><span>qualified places</span></div></header>
    <section className={styles.section}><div className={styles.sectionHeading}><div><span>GROUPS → KNOCKOUT</span><h2>Qualification projection</h2></div><p>Unqualified teams stay out of the fixture path.</p></div><BracketView matches={preview.matches} participants={participants} rounds={preview.rounds} /></section>
    <section className={styles.section}><div className={styles.sectionHeading}><div><span>DOUBLE ELIMINATION</span><h2>Three connected pathways</h2></div><p>Winner bracket, loser bracket, and the final are shown separately.</p></div><BracketView matches={doubleElimination.matches} participants={participants.slice(0, 8)} rounds={doubleElimination.rounds} /></section>
  </main>;
}
