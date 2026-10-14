import { expect, test } from "@playwright/test";
import { DoubleEliminationFormat } from "../../src/domain/formats/double-elimination";
import { LeagueFormat } from "../../src/domain/formats/league";
import { GroupStageFormat } from "../../src/domain/formats/group-stage";
import { SingleEliminationFormat } from "../../src/domain/formats/single-elimination";
import { ensureRequiredCompetitionPages, validateCompetitionPages } from "../../src/domain/competition-pages";
import { calculatePredictionOdds } from "../../src/domain/prediction-odds";
import { resolveEventChampion } from "../../src/domain/champion";
import { normalizeCompetitionBlueprint } from "../../src/domain/blueprints";
import { computeEventAnalystMetrics } from "../../src/domain/analyst";
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
  test("rejects unsafe and broken page links before publishing", () => {
    const pages = ensureRequiredCompetitionPages();
    const invite = pages.find((page) => page.kind === "invite")!;
    invite.enabled = true;
    invite.blocks[0].href = "http://unsafe.example.com";
    expect(validateCompetitionPages(pages).errors[0]).toContain("https://");
    invite.blocks[0].href = "page:missing";
    expect(validateCompetitionPages(pages).errors[0]).toContain("missing");
    invite.blocks[0].href = "/app/opportunities";
    expect(validateCompetitionPages(pages)).toMatchObject({ errors: [] });
  });

  test("derives analyst form and score averages from completed persisted results only", () => {
    const entrants = participants(3);
    const results: Match[] = [
      { id: "a-b", eventId: "event-1", roundId: "round-1", status: MatchStatus.Completed, participantIds: [entrants[0].id, entrants[1].id], participants: [], config: {}, result: { winnerId: entrants[0].id, scores: [{ participantId: entrants[0].id, label: "Points", value: 2 }, { participantId: entrants[1].id, label: "Points", value: 0 }], isWalkover: false }, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z" },
      { id: "b-c", eventId: "event-1", roundId: "round-1", status: MatchStatus.Completed, participantIds: [entrants[1].id, entrants[2].id], participants: [], config: {}, result: { winnerId: entrants[1].id, scores: [{ participantId: entrants[1].id, label: "Points", value: 3 }, { participantId: entrants[2].id, label: "Points", value: 1 }], isWalkover: false }, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:01:00.000Z" },
      { id: "pending", eventId: "event-1", roundId: "round-1", status: MatchStatus.Scheduled, participantIds: [entrants[0].id, entrants[2].id], participants: [], config: {}, createdAt: "2026-10-14T00:02:00.000Z", updatedAt: "2026-10-14T00:02:00.000Z" },
    ];
    const metrics = computeEventAnalystMetrics(results, entrants);
    expect(metrics.find((metric) => metric.id === entrants[0].id)).toMatchObject({ wins: 1, losses: 0, matches: 1, averageFor: 2, averageAgainst: 0, form: ["W"] });
    expect(metrics.find((metric) => metric.id === entrants[1].id)).toMatchObject({ wins: 1, losses: 1, matches: 2, averageFor: 1.5, averageAgainst: 1.5, form: ["L", "W"] });
  });

  test("prices predictions from completed results and withholds estimates without enough form", () => {
    expect(calculatePredictionOdds([], "a", "b")).toBeNull();
    const completed = (id: string, participantIds: string[], winnerId: string): Match => ({
      id, eventId: "event-1", roundId: "round-1", status: MatchStatus.Completed, participantIds, participants: [],
      result: { winnerId, scores: [], isWalkover: false }, config: {}, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
    });
    const matches = [
      completed("match-1", ["a", "c"], "a"),
      completed("match-2", ["b", "c"], "b"),
      completed("match-3", ["a", "b"], "a"),
    ];
    const estimate = calculatePredictionOdds(matches, "a", "b");
    expect(estimate).not.toBeNull();
    expect(estimate![0].probability).toBeGreaterThan(0.5);
    expect(estimate![0].probability + estimate![1].probability).toBeCloseTo(1);
    expect(estimate![0].decimalOdds).toBeCloseTo(1 / estimate![0].probability, 2);
  });

  test("announces only a resolved champion after an event is complete", () => {
    const entrants = participants(2);
    const event: Event = {
      id: "event-1", competitionId: "competition-1", name: "Final Test", format: FormatType.SingleElimination,
      participantType: ParticipantType.Individual, status: EventStatus.Completed, registrationPolicy: RegistrationPolicy.Open,
      config: {}, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
    };
    const stage = { id: "stage-1", eventId: event.id, name: "Knockout", type: "single_elimination", orderIndex: 0, config: {}, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z" };
    const round = { id: "round-final", stageId: stage.id, name: "Final", roundNumber: 1, config: {}, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z" };
    const final: Match = {
      id: "final", eventId: event.id, roundId: round.id, status: MatchStatus.Completed, participantIds: entrants.map((p) => p.id), participants: [],
      result: { winnerId: entrants[0].id, scores: [{ participantId: entrants[0].id, label: "Score", value: 2 }, { participantId: entrants[1].id, label: "Score", value: 1 }], isWalkover: false },
      config: {}, createdAt: "2026-10-14T00:00:00.000Z", updatedAt: "2026-10-14T00:00:00.000Z",
    };
    const input = { event, stages: [stage], rounds: [round], matches: [final], participants: entrants, standings: [] };
    expect(resolveEventChampion({ ...input, event: { ...event, status: EventStatus.InProgress } }).state).toBe("pending");
    expect(resolveEventChampion(input)).toMatchObject({ state: "winner", participant: { id: entrants[0].id }, finalMatch: { id: "final" } });
    expect(resolveEventChampion({ ...input, matches: [{ ...final, result: undefined }] }).state).toBe("pending");
  });

  test("retains the required competition pages while keeping invite opt-in", () => {
    const pages = ensureRequiredCompetitionPages();
    expect(pages.map((page) => page.kind)).toEqual(["home", "invite", "live"]);
    expect(pages.find((page) => page.kind === "home")?.enabled).toBe(true);
    expect(pages.find((page) => page.kind === "invite")?.enabled).toBe(false);
    expect(pages.find((page) => page.kind === "live")?.enabled).toBe(true);
  });

  test("normalizes legacy competition blueprints into safe reusable event templates", () => {
    const normalized = normalizeCompetitionBlueprint({
      competition: { name: "Legacy Cup", description: "A saved competition blueprint.", category: "football", entryType: "team", visibility: "public", eligibility: { region: "South Africa" }, game: { name: "Football", category: "football" } },
      events: [{ id: "old-event-id", competitionId: "old-competition-id", name: "Open League", format: FormatType.League, participantType: ParticipantType.Team, registrationPolicy: RegistrationPolicy.ApprovalRequired, status: EventStatus.Draft, config: { progressionPlan: { phases: [] } }, createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }],
    });
    expect(normalized?.type).toBe("competition");
    expect(normalized?.events[0].event.name).toBe("Open League");
    expect(normalized?.events[0].event).not.toHaveProperty("id");
    expect(normalized?.events[0].event).not.toHaveProperty("competitionId");
  });

  test("names knockout rounds from bracket size instead of showing Round 1", () => {
    const format = new SingleEliminationFormat();
    const quarterFinals = format.createStages("event-1", participants(8), [])[0].rounds;
    expect(quarterFinals.map((round) => round.name)).toEqual(["Quarter-Finals", "Semi-Finals", "Final", "Third Place"]);
    const roundOf16 = format.createStages("event-1", participants(12), [])[0].rounds;
    expect(roundOf16.map((round) => round.name)).toEqual(["Round of 16", "Quarter-Finals", "Semi-Finals", "Final", "Third Place"]);
  });

  test("builds stable single and double elimination structures for 4, 8, 12 and 16 entrants", () => {
    for (const size of [4, 8, 12, 16]) {
      const single = new SingleEliminationFormat().createStages("event-1", participants(size), [])[0];
      const bracketSize = 2 ** Math.ceil(Math.log2(size));
      expect(single.matches.filter((match) => !match.config.thirdPlace)).toHaveLength(bracketSize - 1);
      expect(single.matches.filter((match) => match.config.thirdPlace)).toHaveLength(1);
      expect(single.rounds.at(-2)?.name).toBe("Final");
      expect(single.matches.filter((match) => match.status === MatchStatus.Walkover)).toHaveLength(bracketSize - size);

      const double = new DoubleEliminationFormat().createStages("event-1", participants(size), [{ key: "bracket_reset", value: true }])[0];
      expect(double.rounds.some((round) => round.name === "Grand Final")).toBe(true);
      expect(double.rounds.some((round) => round.name === "Grand Final Reset")).toBe(true);
      expect(double.rounds.some((round) => round.name === "Round 1")).toBe(false);
      expect(new Set(double.matches.map((match) => match.config.engineMatchKey)).size).toBe(double.matches.length);
      expect(double.matches.filter((match) => match.status === MatchStatus.Walkover)).toHaveLength(bracketSize - size);
    }
  });

  test("advances byes and completed results while keeping provisional results out of the bracket", () => {
    const format = new SingleEliminationFormat();
    const byeBracket = format.createStages("event-1", participants(12), [])[0];
    const withByes = format.propagateResults(byeBracket.matches, byeBracket.rounds);
    for (const bye of byeBracket.matches.filter((match) => match.status === MatchStatus.Walkover && match.config.nextMatchKey)) {
      const target = withByes.find((match) => match.config.engineMatchKey === bye.config.nextMatchKey);
      expect(target?.participantIds).toContain(bye.result?.winnerId);
    }

    const bracket = format.createStages("event-2", participants(8), [])[0];
    const sources = bracket.matches.filter((match) => match.config.roundName === "Quarter-Finals").slice(0, 2);
    const targetKey = sources[0].config.nextMatchKey;
    expect(sources[1].config.nextMatchKey).toBe(targetKey);
    const provisional = bracket.matches.map((match) => match.id === sources[0].id
      ? { ...match, status: MatchStatus.InProgress, result: { winnerId: match.participantIds[0], scores: [], isWalkover: false } }
      : match.id === sources[1].id
        ? { ...match, status: MatchStatus.Completed, result: { winnerId: match.participantIds[0], scores: [], isWalkover: false } }
        : match);
    const partiallyAdvanced = format.propagateResults(provisional, bracket.rounds).find((match) => match.config.engineMatchKey === targetKey)!;
    expect(partiallyAdvanced.participantIds).not.toContain(sources[0].participantIds[0]);
    expect(partiallyAdvanced.participantIds).toContain(sources[1].participantIds[0]);
  });

  test("routes semi-final losers to third place and ranks the podium correctly", () => {
    const entrants = participants(4);
    const format = new SingleEliminationFormat();
    const bracket = format.createStages("event-1", entrants, [{ key: "third_place_match", value: true }])[0];
    const semiFinals = bracket.matches.filter((match) => match.config.roundName === "Semi-Finals");
    const completedSemis = bracket.matches.map((match) => {
      if (!semiFinals.some((semi) => semi.id === match.id)) return match;
      return { ...match, status: MatchStatus.Completed, result: { winnerId: match.participantIds[0], scores: [], isWalkover: false } };
    });
    const afterSemis = format.propagateResults(completedSemis, bracket.rounds);
    const final = afterSemis.find((match) => match.config.roundName === "Final" && !match.config.thirdPlace)!;
    const third = afterSemis.find((match) => match.config.thirdPlace)!;
    expect(final.participantIds).toEqual(semiFinals.map((match) => match.participantIds[0]));
    expect(new Set(third.participantIds)).toEqual(new Set(semiFinals.map((match) => match.participantIds[1])));

    const completed = afterSemis.map((match) => match.id === final.id
      ? { ...match, status: MatchStatus.Completed, result: { winnerId: final.participantIds[0], scores: [], isWalkover: false } }
      : match.id === third.id
        ? { ...match, status: MatchStatus.Completed, result: { winnerId: third.participantIds[0], scores: [], isWalkover: false } }
        : match);
    const standings = format.calculateStandings(bracket.stage, completed, entrants, [{ key: "third_place_match", value: true }]);
    expect(standings.find((entry) => entry.participantId === final.participantIds[0])?.rank).toBe(1);
    expect(standings.find((entry) => entry.participantId === final.participantIds[1])?.rank).toBe(2);
    expect(standings.find((entry) => entry.participantId === third.participantIds[0])?.rank).toBe(3);
    expect(standings.find((entry) => entry.participantId === third.participantIds[1])?.rank).toBe(4);
  });

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

  test("double elimination finals create a reset only when the losers-bracket champion wins", () => {
    const entrants = participants(4);
    const format = new DoubleEliminationFormat();
    const [{ rounds, matches }] = format.createStages("event-1", entrants, [{ key: "bracket_reset", value: true }]);
    const final = matches.find((match) => match.config.bracketType === "grand_final")!;
    const reset = matches.find((match) => match.config.bracketType === "grand_final_reset")!;
    const finalWithEntrants: Match = {
      ...final,
      participantIds: [entrants[0].id, entrants[1].id],
      participants: [{ matchId: final.id, participantId: entrants[0].id, position: 1 }, { matchId: final.id, participantId: entrants[1].id, position: 2 }],
      status: MatchStatus.Completed,
      result: { winnerId: entrants[1].id, scores: [], isWalkover: false },
    };
    const resetNeeded = format.propagateResults([reset, finalWithEntrants], rounds).find((match) => match.id === reset.id)!;
    expect(resetNeeded.status).toBe(MatchStatus.Scheduled);
    expect(resetNeeded.participantIds).toEqual([entrants[0].id, entrants[1].id]);

    const noReset = format.propagateResults([reset, { ...finalWithEntrants, result: { winnerId: entrants[0].id, scores: [], isWalkover: false } }], rounds).find((match) => match.id === reset.id)!;
    expect(noReset.status).toBe(MatchStatus.Cancelled);
    expect(noReset.participantIds).toEqual([]);
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
