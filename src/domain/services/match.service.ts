import { type Match, type MatchResult, type MatchScore, type MatchParticipant } from "../match";
import { type ID, MatchStatus } from "../types";
import { GetAll, Get, create, update, Delete, query } from "../../lib/store";
import { writeAudit } from "../audit";
import { ScoreAuditService } from "./score-audit.service";
import { BetService } from "./bet.service";

const MATCH_KEY = "matches";

function flattenResult(data: Record<string, unknown>): void {
  const r = data.result as MatchResult | undefined;
  if (r) {
    data.winnerId = r.winnerId ?? null;
    data.scores = r.scores;
    data.isWalkover = r.isWalkover;
    data.notes = r.notes ?? null;
    data.finalizedBy = r.finalizedBy ?? null;
    data.finalizedAt = r.finalizedAt ?? null;
  }
  delete data.result;
}

async function createMatchParticipant(data: { matchId: string; participantId: string; position: number }): Promise<void> {
  const res = await fetch("/api/match_participants/crud/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item: data }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
}

async function deleteMatchParticipants(matchId: string): Promise<void> {
  const res = await fetch("/api/match_participants/crud/DeleteByMatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchId }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
}

async function getAllMatchParticipants(): Promise<{ matchId: string; participantId: string; position: number; result?: "win" | "loss" | "draw"; score?: number }[]> {
  const res = await fetch("/api/match_participants/crud/GetAll", { method: "POST" });
  const json = await res.json();
  if (json.error) throw new Error(json.error);
  return json.data ?? [];
}

function expandResult(match: Record<string, unknown>): void {
  const winnerId = match.winnerId as string | undefined;
  const scores = match.scores as MatchScore[] | undefined;
  const isWalkover = match.isWalkover as boolean | undefined;
  const notes = match.notes as string | undefined;
  const finalizedBy = match.finalizedBy as string | undefined;
  const finalizedAt = match.finalizedAt as string | undefined;
  if (winnerId !== undefined || scores !== undefined || isWalkover !== undefined || notes !== undefined || finalizedBy !== undefined || finalizedAt !== undefined) {
    match.result = { winnerId, scores: scores ?? [], isWalkover: isWalkover ?? false, notes, finalizedBy, finalizedAt };
  }
  delete match.winnerId;
  delete match.scores;
  delete match.isWalkover;
  delete match.notes;
  delete match.finalizedBy;
  delete match.finalizedAt;
}

export class MatchService {
  private auditSvc = new ScoreAuditService();
  private betSvc = new BetService();

  async list(eventId: ID): Promise<Match[]> {
    const matches = await query<Match>(MATCH_KEY, (m) => m.eventId === eventId);
    return this.populateParticipants(matches);
  }

  async get(id: ID): Promise<Match | undefined> {
    const match = await Get<Match>(MATCH_KEY, id);
    if (!match) return undefined;
    const populated = await this.populateParticipants([match]);
    return populated[0];
  }

  async getByRound(roundId: ID): Promise<Match[]> {
    const matches = await query<Match>(MATCH_KEY, (m) => m.roundId === roundId);
    return this.populateParticipants(matches);
  }

  async createWithParticipants(match: Match): Promise<Match> {
    const { participantIds, participants, ...cleanMatch } = match;
    flattenResult(cleanMatch as unknown as Record<string, unknown>);
    const created = await create<Match>(MATCH_KEY, cleanMatch as Match);
    if (participants.length > 0) {
      for (const mp of participants) {
        await createMatchParticipant({
          matchId: created.id,
          participantId: mp.participantId,
          position: mp.position,
        });
      }
    } else {
      for (let i = 0; i < participantIds.length; i++) {
        await createMatchParticipant({
          matchId: created.id,
          participantId: participantIds[i],
          position: i + 1,
        });
      }
    }
    created.participantIds = participantIds;
    created.participants = participants.length > 0
      ? participants.map((mp) => ({ ...mp, matchId: created.id }))
      : participantIds.map((pid, i) => ({ matchId: created.id, participantId: pid, position: i + 1 }));
    return created;
  }

  private async populateParticipants(matches: Match[]): Promise<Match[]> {
    if (matches.length === 0) return matches;
    const allMatchParticipants = await getAllMatchParticipants();
    for (const match of matches) {
      const mps = allMatchParticipants.filter((mp) => mp.matchId === match.id);
      match.participantIds = mps.map((mp) => mp.participantId);
      match.participants = mps;
      expandResult(match as unknown as Record<string, unknown>);
    }
    return matches;
  }

  async startMatch(matchId: ID, actorId?: ID): Promise<Match | undefined> {
    const before = await this.get(matchId);
    const match = await update<Match>(MATCH_KEY, matchId, {
      status: MatchStatus.InProgress,
      startedAt: new Date().toISOString(),
    });
    if (match) {
      await this.auditSvc.recordMatchStart(matchId, match.eventId);
    }
    if (before && match) {
      await writeAudit("", actorId ?? "", "match.started", "match", matchId, before as unknown as Record<string, unknown>, match as unknown as Record<string, unknown>);
    }
    return match;
  }

  async recordScore(matchId: ID, participantId: ID, score: number, actionType: "set" | "increment" | "decrement"): Promise<void> {
    const match = await this.get(matchId);
    if (!match) return;
    await this.auditSvc.recordScoreEvent(match.eventId, matchId, participantId, score, actionType);
  }

  async updateScores(matchId: ID, scores: MatchScore[]): Promise<Match | undefined> {
    return update<Match>(MATCH_KEY, matchId, { scores } as unknown as Partial<Match>);
  }

  async submitResult(matchId: ID, winnerId?: ID, scores?: MatchScore[], actorId?: ID): Promise<Match | undefined> {
    const before = await this.get(matchId);
    const finalizedAt = new Date().toISOString();
    const result: MatchResult = {
      winnerId,
      scores: scores ?? [],
      isWalkover: false,
      finalizedBy: actorId,
      finalizedAt,
    };
    const updates: Record<string, unknown> = { status: MatchStatus.Completed, result };
    flattenResult(updates);
    const match = await update<Match>(MATCH_KEY, matchId, updates as Partial<Match>);
    if (match) {
      await this.auditSvc.recordMatchFinalize(matchId, match.eventId, result);
      await this.betSvc.settleBets(match);
    }
    if (before && match) {
      await writeAudit("", actorId ?? "", "match.finalized", "match", matchId, before as unknown as Record<string, unknown>, match as unknown as Record<string, unknown>);
    }
    return match;
  }

  async submitDetailedResult(matchId: ID, scores: MatchScore[], notes?: string): Promise<Match | undefined> {
    const match = await this.get(matchId);
    if (!match) return undefined;

    const sorted = [...scores].sort((a, b) => b.value - a.value);
    const winnerId = sorted[0]?.participantId;

    return this.submitResult(matchId, winnerId, scores);
  }

  async dispute(matchId: ID): Promise<Match | undefined> {
    return update<Match>(MATCH_KEY, matchId, { status: MatchStatus.Disputed });
  }

  async resolveDispute(matchId: ID): Promise<Match | undefined> {
    return update<Match>(MATCH_KEY, matchId, { status: MatchStatus.Completed });
  }

  async schedule(matchId: ID, scheduledAt: string, venue?: string): Promise<Match | undefined> {
    return update<Match>(MATCH_KEY, matchId, { scheduledAt, venue });
  }

  async syncParticipants(match: Match): Promise<void> {
    await deleteMatchParticipants(match.id);
    for (const mp of match.participants) {
      await createMatchParticipant({
        matchId: match.id,
        participantId: mp.participantId,
        position: mp.position,
      });
    }
  }

  async undo(matchId: ID): Promise<Match | undefined> {
    const before = await this.get(matchId);
    const match = await update<Match>(MATCH_KEY, matchId, {
      status: MatchStatus.Scheduled,
      winnerId: null,
      scores: [],
      isWalkover: false,
      notes: null,
      finalizedBy: null,
      finalizedAt: null,
    } as unknown as Partial<Match>);
    if (match) {
      await this.betSvc.undoBetSettlement(matchId);
    }
    return match;
  }
}
