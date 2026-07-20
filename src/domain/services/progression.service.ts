import { type ID, MatchStatus, EventStatus, type RuleOverride } from "../types";
import { FormatType } from "../types";
import { type Stage, type Round } from "../event";
import { type Event } from "../event";
import { type Match } from "../match";
import { type Participant } from "../participant";
import { type RuleSet } from "../rules";
import { type ProgressionPlan, type PhaseConfig, type ProgressionLink } from "../progression";
import { type StandingsEntry } from "../formats/interface";
import { getFormat } from "../formats/registry";
import { GetAll, Get, create, update, Delete, query } from "../../lib/store";
import { MatchService } from "./match.service";
import { generateId } from "../../lib/id";

const LINK_KEY = "progression_links";

export class ProgressionService {
  async getProgressionPlan(eventId: ID): Promise<ProgressionPlan | null> {
    const events = await GetAll<Event>("events");
    const event = events.find(e => e.id === eventId);
    if (!event) return null;
    const plan = event.config?.progressionPlan as ProgressionPlan | undefined;
    return plan ?? null;
  }

  async saveProgressionPlan(eventId: ID, plan: ProgressionPlan): Promise<void> {
    const events = await GetAll<Event>("events");
    const idx = events.findIndex(e => e.id === eventId);
    if (idx === -1) return;
    const updated = {
      ...events[idx],
      config: { ...events[idx].config, progressionPlan: plan },
      updatedAt: new Date().toISOString(),
    };
    await update<Event>("events", eventId, updated as Partial<Event>);
  }

  async getProgressionLinks(eventId: ID): Promise<ProgressionLink[]> {
    return query<ProgressionLink>(LINK_KEY, l => l.eventId === eventId);
  }

  async getNextPhaseConfig(eventId: ID, currentStageOrder: number): Promise<PhaseConfig | null> {
    const plan = await this.getProgressionPlan(eventId);
    if (!plan) return null;
    if (currentStageOrder >= plan.phases.length) return null;
    return plan.phases[currentStageOrder];
  }

  async canAdvance(eventId: ID, stageId: ID): Promise<boolean> {
    const existingLinks = await query<ProgressionLink>(LINK_KEY, l => l.eventId === eventId && l.sourceStageId === stageId);
    if (existingLinks.length > 0) return false;

    const stages = await query<Stage>("stages", s => s.eventId === eventId);
    const stage = stages.find(s => s.id === stageId);
    if (!stage) return false;

    const rounds = await query<Round>("rounds", r => r.stageId === stageId);
    const roundIds = new Set(rounds.map(r => r.id));

    const matches = await query<Match>("matches", m => {
      if (m.eventId !== eventId) return false;
      return roundIds.has(m.roundId);
    });

    if (matches.length === 0) return false;

    return matches.every(m =>
      m.status === MatchStatus.Completed ||
      m.status === MatchStatus.Walkover ||
      m.status === MatchStatus.Cancelled
    );
  }

  async advance(eventId: ID, sourceStageId: ID): Promise<{ stage: Stage; rounds: Round[]; matches: Match[] }> {
    const events = await GetAll<Event>("events");
    const event = events.find(e => e.id === eventId);
    if (!event) throw new Error("Event not found");

    const stages = await query<Stage>("stages", s => s.eventId === eventId);
    const sortedStages = stages.sort((a, b) => a.orderIndex - b.orderIndex);
    const sourceStage = sortedStages.find(s => s.id === sourceStageId);
    if (!sourceStage) throw new Error("Source stage not found");

    const plan = await this.getProgressionPlan(eventId);
    if (!plan) throw new Error("No progression plan configured");

    const currentPhaseIdx = sortedStages.findIndex(s => s.id === sourceStageId);
    if (currentPhaseIdx === -1) throw new Error("Source stage not found in stages list");
    if (currentPhaseIdx >= plan.phases.length) throw new Error("No next phase configured");
    const nextPhase = plan.phases[currentPhaseIdx];

    const participants = await query<Participant>("participants", p => p.eventId === eventId && p.status === "active");
    const allMatches = await query<Match>("matches", m => m.eventId === eventId);
    const rulesets = await query<RuleSet>("rulesets", () => true);
    const ruleSet = rulesets.find(rs => rs.eventId === eventId);
    const rules = ruleSet?.rules ?? [];

    const format = getFormat(event.format);
    const sourceStageRounds = await query<Round>("rounds", r => r.stageId === sourceStageId);
    const sourceStageRoundIds = new Set(sourceStageRounds.map(r => r.id));
    const sourceStageMatches = allMatches.filter(m => sourceStageRoundIds.has(m.roundId));

    const standings = format.calculateStandings(sourceStage, sourceStageMatches, participants, rules);
    const qualifierIds = format.advanceParticipants(sourceStage, standings, rules);

    const qualifierParticipants = qualifierIds
      .map(id => participants.find(p => p.id === id))
      .filter((p): p is Participant => p !== undefined);

    if (qualifierParticipants.length < 2) {
      throw new Error("Not enough qualifiers to create next stage");
    }

    const nextFormat = getFormat(nextPhase.format);
    const stageResults = nextFormat.createStages(eventId, qualifierParticipants, rules);

    for (const result of stageResults) {
      result.stage.orderIndex = currentPhaseIdx + 1;
      const createdStage = await create("stages", result.stage);

      // Build a map from client-generated roundId → server-generated roundId
      const clientToServerRoundId = new Map<string, string>();

      // Save rounds first so we can collect their server-generated IDs
      for (const round of result.rounds) {
        const clientRoundId = round.id;
        (round as unknown as Record<string, unknown>).stageId = createdStage.id;
        const createdRound = await create("rounds", round);
        clientToServerRoundId.set(clientRoundId, createdRound.id);
      }

      // Update matches with real server-generated roundIds before saving
      const matchSvc = new MatchService();
      for (const match of result.matches) {
        if (match.roundId && clientToServerRoundId.has(match.roundId)) {
          match.roundId = clientToServerRoundId.get(match.roundId)!;
        }
        await matchSvc.createWithParticipants(match);
      }

      const link: ProgressionLink = {
        id: generateId(),
        eventId,
        sourceStageId,
        targetStageId: createdStage.id,
        qualifierCount: qualifierParticipants.length,
        status: "completed",
        createdAt: new Date().toISOString(),
      };
      await create(LINK_KEY, link);

      return { stage: result.stage, rounds: result.rounds, matches: result.matches };
    }

    throw new Error("Failed to create next stage");
  }

  async getStages(eventId: ID): Promise<Stage[]> {
    const stages = await query<Stage>("stages", s => s.eventId === eventId);
    return stages.sort((a, b) => a.orderIndex - b.orderIndex);
  }

  async getRounds(stageId: ID): Promise<Round[]> {
    const rounds = await query<Round>("rounds", r => r.stageId === stageId);
    return rounds.sort((a, b) => a.roundNumber - b.roundNumber);
  }
}
