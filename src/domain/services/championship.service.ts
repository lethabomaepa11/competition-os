import { type ID, FormatType } from "../types";
import { getNumberRule } from "../rules";
import { query } from "../../lib/store";
import { EventService } from "./event.service";
import { RegistrationService } from "./registration.service";
import { StandingsService } from "./standings.service";

const CHAMP_KEY = "championship_points";

export interface ChampionshipPoints {
  id: string;
  championshipId: ID;
  participantId: ID;
  participantName: string;
  totalPoints: number;
  eventsPlayed: number;
  placements: { eventId: ID; eventName: string; points: number; rank: number }[];
}

export class ChampionshipService {
  async calculatePoints(championshipEventId: ID): Promise<ChampionshipPoints[]> {
    const eventSvc = new EventService();
    const regSvc = new RegistrationService();
    const standingsSvc = new StandingsService();

    const champEvent = await eventSvc.get(championshipEventId);
    if (!champEvent) return [];

    const allEvents = await eventSvc.list(champEvent.competitionId);
    const subEvents = allEvents.filter(e => e.id !== championshipEventId && e.status === "completed");

    const ruleSet = await eventSvc.getRuleSet(championshipEventId);
    const rules = ruleSet?.rules ?? [];

    const pointsSchedule = [
      getNumberRule(rules, "points_1st", FormatType.Championship),
      getNumberRule(rules, "points_2nd", FormatType.Championship),
      getNumberRule(rules, "points_3rd", FormatType.Championship),
      getNumberRule(rules, "points_4th", FormatType.Championship),
    ];
    const participationPts = getNumberRule(rules, "participation_points", FormatType.Championship);

    const pointsMap = new Map<string, ChampionshipPoints>();

    for (const subEvent of subEvents) {
      const stages = await eventSvc.getStages(subEvent.id);
      const participants = await regSvc.getParticipants(subEvent.id);

      for (const p of participants) {
        if (!pointsMap.has(p.id)) {
          pointsMap.set(p.id, {
            id: p.id,
            championshipId: championshipEventId,
            participantId: p.id,
            participantName: p.displayName,
            totalPoints: 0,
            eventsPlayed: 0,
            placements: [],
          });
        }
      }

      if (stages.length > 0) {
        const standings = await standingsSvc.calculate(subEvent.id, stages[0].id);

        for (let i = 0; i < standings.length; i++) {
          const entry = standings[i];
          let pts = participationPts;
          if (i < pointsSchedule.length) {
            pts = Math.max(pts, pointsSchedule[i]);
          }

          const cp = pointsMap.get(entry.participantId);
          if (cp) {
            cp.totalPoints += pts;
            cp.eventsPlayed++;
            cp.placements.push({
              eventId: subEvent.id,
              eventName: subEvent.name,
              points: pts,
              rank: entry.rank,
            });
          }
        }

        const qualifiedPids = await standingsSvc.getQualifiers(subEvent.id, stages[0].id);
        for (const pid of qualifiedPids) {
          const cp = pointsMap.get(pid);
          if (cp) {
            cp.totalPoints += Math.max(...pointsSchedule) / 2;
          }
        }
      }
    }

    const result = Array.from(pointsMap.values());
    result.sort((a, b) => b.totalPoints - a.totalPoints);
    return result;
  }
}
