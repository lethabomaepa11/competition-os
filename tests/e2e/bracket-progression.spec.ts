import { expect, test } from "@playwright/test";
import { DoubleEliminationFormat } from "../../src/domain/formats/double-elimination";
import { LeagueFormat } from "../../src/domain/formats/league";
import { GroupStageFormat } from "../../src/domain/formats/group-stage";
import { createGroupStageBracketPreview } from "../../src/domain/formats/group-stage-preview";
import { EventStatus, FormatType, MatchStatus, ParticipantType, RegistrationPolicy } from "../../src/domain/types";
import type { Participant } from "../../src/domain/participant";
import type { Match } from "../../src/domain/match";
import type { Event } from "../../src/domain/event";
import type { StandingsEntry } from "../../src/domain/formats/interface";

function participants(count: number): Participant[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `participant-${index + 1}`,
    eventId: "event-1",
    memberId: `member-${index + 1}`,
    displayName: `Player ${index + 1}`,
    seed: index + 1,
    status: "active",
    registeredAt: "2026-10-14T00:00:00.000Z",
    createdAt: "2026-10-14T00:00:00.000Z",
    updatedAt: "2026-10-14T00:00:00.000Z",
  }));
}

test.describe("competition structure integrity", () => {
  test("double elimination advances adjacent fixture winners into their declared slots", () => {
    const format = new DoubleEliminationFormat();
    const [{ rounds, matches }] = format.createStages("event-1", participants(8), []);
    const grouped = new Map<string, Match[]>();

    for (const match of matches) {
      const nextKey = match.config.nextMatchKey as string | undefined;
      if (!nextKey || match.bracketGroup !== "winners" || match.participantIds.length !== 2) continue;
      grouped.set(nextKey, [...(grouped.get(nextKey) ?? []), match]);
    }

    const pair = [...grouped.entries()].find(([, sources]) => sources.length === 2);
    expect(pair).toBeTruthy();
    const [targetKey, sources] = pair!;
    const expected = new Map<number, string>();

    const completed = matches.map((match) => {
      const source = sources.find((item) => item.id === match.id);
      if (!source) return match;
      const winnerId = source.participantIds[0];
      const position = source.config.nextMatchSlot === "player2" ? 2 : 1;
      expected.set(position, winnerId);
      return { ...match, status: MatchStatus.Completed, result: { winnerId, scores: [], isWalkover: false } };
    });

    // Database reads do not guarantee bracket order. Routing must remain correct.
    const propagated = format.propagateResults([...completed].reverse(), rounds);
    const target = propagated.find((match) => match.config.engineMatchKey === targetKey);
    expect(target?.participants).toHaveLength(2);
    expect(target?.participants.find((item) => item.position === 1)?.participantId).toBe(expected.get(1));
    expect(target?.participants.find((item) => item.position === 2)?.participantId).toBe(expected.get(2));
  });

  test("league generation schedules every pairing exactly once", () => {
    const [{ matches }] = new LeagueFormat().createStages("event-1", participants(6), []);
    const pairings = matches.map((match) => [...match.participantIds].sort().join(":"));
    expect(pairings).toHaveLength(15);
    expect(new Set(pairings).size).toBe(15);
  });

  test("group-stage preview seeds only ranked qualifiers even when standings arrive shuffled", () => {
    const entrants = participants(12);
    const rules = [
      { key: "group_count", value: 4 },
      { key: "qualifiers_per_group", value: 2 },
    ];
    const [source] = new GroupStageFormat().createStages("event-1", entrants, rules);
    const standings: StandingsEntry[] = [];
    const groups = source.stage.config.groups as string[][];
    groups.forEach((group, groupIndex) => {
      group.forEach((participantId, index) => {
        standings.push({
          participantId,
          displayName: participantId,
          rank: index + 1,
          points: group.length - index,
          wins: 0,
          losses: 0,
          draws: 0,
          stats: { groupIndex },
          qualified: index < 2,
        });
      });
    });
    const event: Event = {
      id: "event-1",
      competitionId: "competition-1",
      name: "Qualification Test",
      format: FormatType.GroupStage,
      participantType: ParticipantType.Individual,
      status: EventStatus.InProgress,
      registrationPolicy: RegistrationPolicy.Open,
      config: {},
      createdAt: "2026-10-14T00:00:00.000Z",
      updatedAt: "2026-10-14T00:00:00.000Z",
    };

    const preview = createGroupStageBracketPreview(
      event,
      source.stage,
      [...standings].reverse(),
      entrants,
      rules,
      FormatType.SingleElimination,
    );

    const expectedQualifiers = new Set(groups.flatMap((group) => group.slice(0, 2)));
    expect(preview?.participantIds).toHaveLength(8);
    expect(new Set(preview?.participantIds)).toEqual(expectedQualifiers);
    expect(preview?.participantIds.every((id) => expectedQualifiers.has(id))).toBe(true);
  });
});
