import { type Event, type Stage, type Round } from "../event";
import { type RuleSet } from "../rules";
import { type RuleOverride } from "../types";
import { type Match, type MatchParticipant } from "../match";
import { type Participant, type Team } from "../participant";
import { type ID, EventStatus, FormatType, RegistrationPolicy, ParticipantType, MatchStatus } from "../types";
import { GetWhere, GetWhereIn, Get, create, update, Delete } from "../../lib/store";
import { MatchService } from "./match.service";
import { generateId } from "../../lib/id";
import { writeAudit } from "../audit";
import { getFormat } from "../formats/registry";
import { SwissFormat } from "../formats/swiss";

const EVT_KEY = "events";
const STAGE_KEY = "stages";
const ROUND_KEY = "rounds";
const RULESET_KEY = "rulesets";

export class EventService {
  async list(competitionId: ID): Promise<Event[]> {
    return GetWhere<Event>(EVT_KEY, { competitionId });
  }

  async get(id: ID): Promise<Event | undefined> {
    return Get<Event>(EVT_KEY, id);
  }

  async getDetail(eventId: ID): Promise<{
    event: Event;
    stages: Stage[];
    rounds: Round[];
    matches: Match[];
    matchParticipants: MatchParticipant[];
    participants: Participant[];
    teams: Team[];
    ruleSets: RuleSet[];
  }> {
    const res = await fetch(`/api/events/${eventId}/detail`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
  }

  async create(data: {
    competitionId: ID;
    name: string;
    format: FormatType;
    participantType?: ParticipantType;
    registrationPolicy?: RegistrationPolicy;
    maxParticipants?: number;
    minParticipants?: number;
  }, actorId: ID): Promise<Event> {
    const now = new Date().toISOString();
    const event: Event = {
      id: generateId(),
      competitionId: data.competitionId,
      name: data.name,
      format: data.format,
      participantType: data.participantType ?? ParticipantType.Individual,
      registrationPolicy: data.registrationPolicy ?? RegistrationPolicy.Open,
      maxParticipants: data.maxParticipants,
      minParticipants: data.minParticipants,
      status: EventStatus.Draft,
      config: {},
      createdAt: now,
      updatedAt: now,
    };
    const created = await create(EVT_KEY, event);
    await writeAudit("", actorId, "event.created", "event", created.id, {}, created as unknown as Record<string, unknown>);
    return created;
  }

  async update(id: ID, data: Partial<Event>, actorId: ID): Promise<Event | undefined> {
    const before = await this.get(id);
    const after = await update<Event>(EVT_KEY, id, data);
    if (before && after) {
      await writeAudit("", actorId, "event.updated", "event", id, before as unknown as Record<string, unknown>, after as unknown as Record<string, unknown>);
    }
    return after;
  }

  async start(id: ID): Promise<Event | undefined> {
    return update<Event>(EVT_KEY, id, { status: EventStatus.InProgress });
  }

  async complete(id: ID): Promise<Event | undefined> {
    return update<Event>(EVT_KEY, id, { status: EventStatus.Completed });
  }

  async Delete(id: ID): Promise<boolean> {
    return Delete(EVT_KEY, id);
  }

  async getStages(eventId: ID): Promise<Stage[]> {
    const stages = await GetWhere<Stage>(STAGE_KEY, { eventId });
    return stages.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getRounds(stageId: ID): Promise<Round[]> {
    const rounds = await GetWhere<Round>(ROUND_KEY, { stageId });
    return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  }

  async getMatches(eventId: ID): Promise<Match[]> {
    return GetWhere<Match>("matches", { eventId });
  }

  async clearEventFixtures(eventId: ID): Promise<void> {
    const stages = await this.getStages(eventId);
    const allRoundIds: string[] = [];
    for (const stage of stages) {
      const rounds = await this.getRounds(stage.id);
      allRoundIds.push(...rounds.map(r => r.id));
    }
    const allMatches = await GetWhereIn<Match>("matches", "roundId", allRoundIds);
    const byRoundId = new Map<string, Match[]>();
    for (const m of allMatches) {
      const list = byRoundId.get(m.roundId);
      if (list) list.push(m); else byRoundId.set(m.roundId, [m]);
    }
    for (const stage of stages) {
      const rounds = await this.getRounds(stage.id);
      for (const round of rounds) {
        const stageMatches = byRoundId.get(round.id) ?? [];
        for (const m of stageMatches) await Delete("matches", m.id);
        await Delete(ROUND_KEY, round.id);
      }
      await Delete(STAGE_KEY, stage.id);
    }
  }

  async hasPlayedMatches(eventId: ID): Promise<boolean> {
    const matches = await this.getMatches(eventId);
    return matches.some((m) => m.status !== "scheduled");
  }

  async getRuleSet(eventId: ID): Promise<RuleSet | undefined> {
    const rulesets = await GetWhere<RuleSet>(RULESET_KEY, { eventId });
    return rulesets[0];
  }

  async saveRuleSet(eventId: ID, rules: RuleOverride[]): Promise<RuleSet> {
    const existing = await GetWhere<RuleSet>(RULESET_KEY, { eventId });
    if (existing.length > 0) {
      const updated = await update<RuleSet>(RULESET_KEY, existing[0].id, { rules });
      return updated!;
    }
    return create(RULESET_KEY, {
      id: generateId(),
      eventId,
      name: "Default Rule Set",
      rules,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  async generateSwissRound(eventId: ID, stageId: ID): Promise<Match[]> {
    const event = await this.get(eventId);
    if (!event) throw new Error("Event not found");

    const format = getFormat(event.format);
    if (!(format instanceof SwissFormat)) throw new Error("Not a Swiss format event");

    const stages = await this.getStages(eventId);
    const stage = stages.find(s => s.id === stageId);
    if (!stage) throw new Error("Stage not found");

    const allMatches = await this.getMatches(eventId);
    const allParticipants = await GetWhere<Participant>("participants", { eventId, status: "active" });
    const ruleSet = await this.getRuleSet(eventId);
    const rules = ruleSet?.rules ?? [];

    const rounds = await this.getRounds(stageId);

    const completedRoundNumbers = new Set<number>();
    for (const m of allMatches) {
      if (m.status === MatchStatus.Completed || m.status === MatchStatus.Walkover) {
        const r = rounds.find(rr => rr.id === m.roundId);
        if (r) completedRoundNumbers.add(r.roundNumber);
      }
    }

    const nextRoundNumber = Math.max(0, ...completedRoundNumbers) + 1;
    const nextRound = rounds.find(r => r.roundNumber === nextRoundNumber);
    if (!nextRound) throw new Error(`Round ${nextRoundNumber} not found. Swiss may be complete.`);

    const existingRoundMatches = allMatches.filter(m => m.roundId === nextRound.id);
    for (const m of existingRoundMatches) {
      await Delete("matches", m.id);
    }

    const swissFormat = format as SwissFormat;
    const newMatches = swissFormat.pairRound(
      eventId, stage, nextRound.id, nextRoundNumber,
      allMatches, allParticipants, rules,
    );

    const matchSvc = new MatchService();
    for (const m of newMatches) {
      await matchSvc.createWithParticipants(m);
    }

    await writeAudit(
      "",
      "",
      "swiss.round_generated",
      "event",
      eventId,
      { roundNumber: nextRoundNumber },
      { matchCount: newMatches.length },
    );

    return newMatches;
  }

  async initializeEvent(eventId: ID, participants: Participant[]): Promise<{ stages: Stage[]; rounds: Round[]; matches: Match[] }> {
    const event = await this.get(eventId);
    if (!event) throw new Error("Event not found");

    const ruleSet = await this.getRuleSet(eventId);
    const rules = ruleSet?.rules ?? [];
    const format = getFormat(event.format);

    const stageResults = format.createStages(eventId, participants, rules);

    const allStages: Stage[] = [];
    const allRounds: Round[] = [];
    const allMatches: Match[] = [];

    for (const result of stageResults) {
      const serverStage = await create(STAGE_KEY, result.stage) as Stage;
      allStages.push(serverStage);

      const roundIdMap = new Map<string, string>();
      for (const round of result.rounds) {
        round.stageId = serverStage.id;
        const oldRoundId = round.id;
        const serverRound = await create(ROUND_KEY, round) as Round;
        roundIdMap.set(oldRoundId, serverRound.id);
        allRounds.push(serverRound);
      }

      const matchSvc = new MatchService();
      for (const match of result.matches) {
        match.eventId = eventId;
        const mapped = roundIdMap.get(match.roundId);
        if (mapped) match.roundId = mapped;
        const serverMatch = await matchSvc.createWithParticipants(match);
        allMatches.push(serverMatch);
      }
    }

    return { stages: allStages, rounds: allRounds, matches: allMatches };
  }
}
