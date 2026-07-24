import { type ID } from "../types";
import { type StandingsEntry } from "../formats/interface";
import { getFormat } from "../formats/registry";
import { EventService } from "./event.service";

export class StandingsService {
  async calculate(eventId: ID, stageId: ID): Promise<StandingsEntry[]> {
    const res = await fetch(`/api/events/${eventId}/standings?stageId=${stageId}`);
    const json = await res.json();
    if (json.error) throw new Error(json.error);
    return json.data;
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
