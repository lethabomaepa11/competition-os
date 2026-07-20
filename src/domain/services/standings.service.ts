import { type Match } from "../match";
import { type Participant } from "../participant";
import { type Stage } from "../event";
import { type RuleOverride, type ID, FormatType } from "../types";
import { type StandingsEntry } from "../formats/interface";
import { getFormat } from "../formats/registry";
import { EventService } from "./event.service";
import { RegistrationService } from "./registration.service";
import { MatchService } from "./match.service";

export class StandingsService {
  async calculate(eventId: ID, stageId: ID): Promise<StandingsEntry[]> {
    const eventSvc = new EventService();
    const regSvc = new RegistrationService();
    const matchSvc = new MatchService();

    const event = await eventSvc.get(eventId);
    if (!event) return [];

    const stages = await eventSvc.getStages(eventId);
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return [];

    const stageRoundIds = new Set((await eventSvc.getRounds(stageId)).map(r => r.id));
    const allMatches = await matchSvc.list(eventId);
    const matches = allMatches.filter(m => stageRoundIds.has(m.roundId));
    const participants = await regSvc.getParticipants(eventId);
    const ruleSet = await eventSvc.getRuleSet(eventId);
    const rules = ruleSet?.rules ?? [];

    const format = getFormat(event.format);
    return format.calculateStandings(stage, matches, participants, rules);
  }

  async getQualifiers(eventId: ID, stageId: ID): Promise<string[]> {
    const eventSvc = new EventService();
    const event = await eventSvc.get(eventId);
    if (!event) return [];

    const stages = await eventSvc.getStages(eventId);
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return [];

    const standings = await this.calculate(eventId, stageId);
    const ruleSet = await eventSvc.getRuleSet(eventId);
    const rules = ruleSet?.rules ?? [];

    const format = getFormat(event.format);
    return format.advanceParticipants(stage, standings, rules);
  }
}
