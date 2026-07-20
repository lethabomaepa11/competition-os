import { type ID } from "../types";
import { type ScoreAuditEntry, type MatchTiming, type ParticipantScoreSummary, type MatchScoreEvent, type InterestingFact, type MatchInsight } from "../score-audit";
import { type Match, type MatchResult } from "../match";
import { type Participant } from "../participant";
import { generateId } from "../../lib/id";
import { GetAll, create, query } from "../../lib/store";
import { MatchStatus } from "../types";

const AUDIT_KEY = "score_audit_entries";
const TIMING_KEY = "match_timings";

export class ScoreAuditService {
  async recordScoreEvent(
    eventId: ID,
    matchId: ID,
    participantId: ID,
    score: number,
    actionType: ScoreAuditEntry["actionType"],
    roundNumber?: number,
    stageName?: string,
  ): Promise<ScoreAuditEntry> {
    const existing = await this.getMatchEvents(matchId);
    const firstEvent = existing[0];
    const matchElapsedMs = firstEvent ? Date.now() - new Date(firstEvent.timestamp).getTime() : 0;

    const entry: ScoreAuditEntry = {
      id: generateId(),
      matchId,
      eventId,
      participantId,
      score,
      actionType,
      timestamp: new Date().toISOString(),
      matchElapsedMs,
      roundNumber,
      stageName,
    };
    await create(AUDIT_KEY, entry);
    return entry;
  }

  async recordMatchStart(matchId: ID, eventId: ID): Promise<void> {
    const timing: MatchTiming = {
      id: generateId(),
      matchId,
      eventId,
      startedAt: new Date().toISOString(),
    };
    await create(TIMING_KEY, timing);
  }

  async recordMatchFinalize(matchId: ID, eventId: ID, result: MatchResult): Promise<void> {
    const timings = (await GetAll<MatchTiming>(TIMING_KEY)).filter(t => t.matchId === matchId);

    const timing = timings[timings.length - 1];
    if (timing) {
      timing.finalizedAt = result.finalizedAt ?? new Date().toISOString();
      timing.durationMs = new Date(timing.finalizedAt).getTime() - new Date(timing.startedAt).getTime();
    }
    for (const score of result.scores) {
      await this.recordScoreEvent(eventId, matchId, score.participantId, score.value, "finalize");
    }
  }

  async getMatchEvents(matchId: ID): Promise<ScoreAuditEntry[]> {
    const events = await query<ScoreAuditEntry>(AUDIT_KEY, e => e.matchId === matchId);
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getMatchTiming(matchId: ID): Promise<MatchTiming | undefined> {
    const timings = (await GetAll<MatchTiming>(TIMING_KEY)).filter(t => t.matchId === matchId);
    return timings[timings.length - 1];
  }

  async getEventScoreEvents(eventId: ID): Promise<ScoreAuditEntry[]> {
    const events = await query<ScoreAuditEntry>(AUDIT_KEY, e => e.eventId === eventId);
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async getParticipantScoreEvents(eventId: ID, participantId: ID): Promise<ScoreAuditEntry[]> {
    const events = await query<ScoreAuditEntry>(AUDIT_KEY, e => e.eventId === eventId && e.participantId === participantId);
    return events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private getParticipantResults(eventId: ID, participantId: ID, matches: Match[]): ("win" | "loss" | "draw")[] {
    const results: ("win" | "loss" | "draw")[] = [];
    const sorted = [...matches]
      .filter(m => m.status === MatchStatus.Completed && m.participantIds.includes(participantId) && m.result)
      .sort((a, b) => new Date(b.result!.finalizedAt!).getTime() - new Date(a.result!.finalizedAt!).getTime());

    for (const m of sorted) {
      if (!m.result) continue;
      if (m.result.winnerId === participantId) results.unshift("win");
      else if (m.result.winnerId) results.unshift("loss");
      else results.unshift("draw");
    }
    return results;
  }

  getParticipantSummary(
    participantId: ID,
    participantName: string,
    eventId: ID,
    matches: Match[],
  ): ParticipantScoreSummary {
    const participantMatches = matches.filter(
      m => m.participantIds.includes(participantId) && m.status === MatchStatus.Completed && m.result
    );

    let wins = 0, losses = 0, draws = 0;
    let totalScoreFor = 0, totalScoreAgainst = 0;
    let highestScore = 0, lowestScore = Infinity;
    let comebackWins = 0, dominantWins = 0, closeWins = 0;
    let totalDurationMs = 0, durationCount = 0;

    for (const m of participantMatches) {
      const r = m.result!;
      const myScore = r.scores.find(s => s.participantId === participantId);
      const theirScore = r.scores.find(s => s.participantId !== participantId);
      const myVal = myScore?.value ?? 0;
      const theirVal = theirScore?.value ?? 0;

      if (r.winnerId === participantId) wins++;
      else if (r.winnerId) losses++;
      else draws++;

      totalScoreFor += myVal;
      totalScoreAgainst += theirVal;
      highestScore = Math.max(highestScore, myVal);
      lowestScore = Math.min(lowestScore, myVal);
    }

    if (lowestScore === Infinity) lowestScore = 0;

    const results = this.getParticipantResults(eventId, participantId, matches);
    let currentWinStreak = 0, currentLossStreak = 0;
    let longestWinStreak = 0, longestLossStreak = 0;
    let tempStreak = 0;
    let currentStreakType: "win" | "loss" | null = null;

    for (const r of results) {
      if (r === "win") {
        if (currentStreakType === "win") tempStreak++;
        else { tempStreak = 1; currentStreakType = "win"; }
        longestWinStreak = Math.max(longestWinStreak, tempStreak);
      } else if (r === "loss") {
        if (currentStreakType === "loss") tempStreak++;
        else { tempStreak = 1; currentStreakType = "loss"; }
        longestLossStreak = Math.max(longestLossStreak, tempStreak);
      } else {
        currentStreakType = null;
        tempStreak = 0;
      }
    }

    const lastResults = results.slice(-5);

    return {
      participantId,
      displayName: participantName,
      totalMatches: participantMatches.length,
      wins,
      losses,
      draws,
      totalScoreFor,
      totalScoreAgainst,
      avgScoreFor: participantMatches.length > 0 ? Math.round((totalScoreFor / participantMatches.length) * 10) / 10 : 0,
      avgScoreAgainst: participantMatches.length > 0 ? Math.round((totalScoreAgainst / participantMatches.length) * 10) / 10 : 0,
      highestScore,
      lowestScore,
      currentWinStreak,
      currentLossStreak,
      longestWinStreak,
      longestLossStreak,
      last5Results: lastResults,
      avgMatchDurationMs: durationCount > 0 ? Math.round(totalDurationMs / durationCount) : 0,
      comebackWins,
      dominantWins,
      closeWins,
    };
  }

  generateFacts(
    match: Match,
    p1Summary: ParticipantScoreSummary,
    p2Summary: ParticipantScoreSummary,
    allMatches: Match[],
    eventId: ID,
  ): InterestingFact[] {
    const facts: InterestingFact[] = [];

    if (p1Summary.totalMatches >= 2 || p2Summary.totalMatches >= 2) {
      if (p1Summary.currentWinStreak >= 3) {
        facts.push({
          type: "streak",
          title: "On Fire!",
          description: `${p1Summary.displayName} is on a ${p1Summary.currentWinStreak}-match win streak`,
          severity: p1Summary.currentWinStreak >= 5 ? "amazing" : "interesting",
          participantIds: [p1Summary.participantId],
        });
      }
      if (p2Summary.currentWinStreak >= 3) {
        facts.push({
          type: "streak",
          title: "On Fire!",
          description: `${p2Summary.displayName} is on a ${p2Summary.currentWinStreak}-match win streak`,
          severity: p2Summary.currentWinStreak >= 5 ? "amazing" : "interesting",
          participantIds: [p2Summary.participantId],
        });
      }

      if (p1Summary.wins > 0 && p1Summary.losses === 0 && p1Summary.totalMatches >= 2) {
        facts.push({
          type: "perfect_record",
          title: "Perfect Record",
          description: `${p1Summary.displayName} is undefeated (${p1Summary.wins}-${p1Summary.draws > 0 ? p1Summary.draws + "D" : "0L"}) in this event`,
          severity: "amazing",
          participantIds: [p1Summary.participantId],
        });
      }
      if (p2Summary.wins > 0 && p2Summary.losses === 0 && p2Summary.totalMatches >= 2) {
        facts.push({
          type: "perfect_record",
          title: "Perfect Record",
          description: `${p2Summary.displayName} is undefeated (${p2Summary.wins}-${p2Summary.draws > 0 ? p2Summary.draws + "D" : "0L"}) in this event`,
          severity: "amazing",
          participantIds: [p2Summary.participantId],
        });
      }
    }

    if (p1Summary.comebackWins > 0) {
      facts.push({
        type: "comeback",
        title: "Comeback King",
        description: `${p1Summary.displayName} has ${p1Summary.comebackWins} comeback win(s) — thrives under pressure`,
        severity: p1Summary.comebackWins >= 3 ? "amazing" : "interesting",
        participantIds: [p1Summary.participantId],
      });
    }
    if (p2Summary.comebackWins > 0) {
      facts.push({
        type: "comeback",
        title: "Comeback King",
        description: `${p2Summary.displayName} has ${p2Summary.comebackWins} comeback win(s) — thrives under pressure`,
        severity: p2Summary.comebackWins >= 3 ? "amazing" : "interesting",
        participantIds: [p2Summary.participantId],
      });
    }

    if (p1Summary.closeWins > 0) {
      const closeRate = Math.round((p1Summary.closeWins / Math.max(1, p1Summary.wins)) * 100);
      if (closeRate >= 50) {
        facts.push({
          type: "close_match",
          title: "Clutch Player",
          description: `${p1Summary.displayName} wins close matches ${closeRate}% of the time — clutch performer`,
          severity: "interesting",
          participantIds: [p1Summary.participantId],
        });
      }
    }
    if (p2Summary.closeWins > 0) {
      const closeRate = Math.round((p2Summary.closeWins / Math.max(1, p2Summary.wins)) * 100);
      if (closeRate >= 50) {
        facts.push({
          type: "close_match",
          title: "Clutch Player",
          description: `${p2Summary.displayName} wins close matches ${closeRate}% of the time — clutch performer`,
          severity: "interesting",
          participantIds: [p2Summary.participantId],
        });
      }
    }

    if (p1Summary.dominantWins > 0) {
      facts.push({
        type: "dominant",
        title: "Dominant Force",
        description: `${p1Summary.displayName} has ${p1Summary.dominantWins} dominant win(s) (won by 5+)`,
        severity: p1Summary.dominantWins >= 3 ? "amazing" : "interesting",
        participantIds: [p1Summary.participantId],
      });
    }
    if (p2Summary.dominantWins > 0) {
      facts.push({
        type: "dominant",
        title: "Dominant Force",
        description: `${p2Summary.displayName} has ${p2Summary.dominantWins} dominant win(s) (won by 5+)`,
        severity: p2Summary.dominantWins >= 3 ? "amazing" : "interesting",
        participantIds: [p2Summary.participantId],
      });
    }

    if (p1Summary.longestLossStreak >= 3) {
      facts.push({
        type: "streak",
        title: "Struggling",
        description: `${p1Summary.displayName} has lost ${p1Summary.longestLossStreak} consecutive matches before`,
        severity: "normal",
        participantIds: [p1Summary.participantId],
      });
    }
    if (p2Summary.longestLossStreak >= 3) {
      facts.push({
        type: "streak",
        title: "Struggling",
        description: `${p2Summary.displayName} has lost ${p2Summary.longestLossStreak} consecutive matches before`,
        severity: "normal",
        participantIds: [p2Summary.participantId],
      });
    }

    if (p1Summary.avgMatchDurationMs > 0 && p2Summary.avgMatchDurationMs > 0) {
      const ratio = p1Summary.avgMatchDurationMs / p2Summary.avgMatchDurationMs;
      if (ratio > 1.3) {
        facts.push({
          type: "duration",
          title: "Methodical vs Quick",
          description: `${p1Summary.displayName}'s matches last ${Math.round(ratio * 100 - 100)}% longer on average — methodical play style`,
          severity: "interesting",
          participantIds: [p1Summary.participantId, p2Summary.participantId],
        });
      } else if (ratio < 0.7) {
        facts.push({
          type: "duration",
          title: "Blitz Player",
          description: `${p1Summary.displayName} finishes matches ${Math.round((1 / ratio) * 100 - 100)}% faster than ${p2Summary.displayName}`,
          severity: "interesting",
          participantIds: [p1Summary.participantId, p2Summary.participantId],
        });
      }
    }

    const allCompleted = allMatches.filter(m => m.status === MatchStatus.Completed && m.result);
    if (allCompleted.length > 0) {
      const highestScoringParticipant = allCompleted.reduce<{ pid: ID; score: number; name: string } | null>((best, m) => {
        for (const s of m.result?.scores ?? []) {
          if (!best || s.value > best.score) {
            const name = s.participantId === p1Summary.participantId ? p1Summary.displayName :
              s.participantId === p2Summary.participantId ? p2Summary.displayName : "?";
            return { pid: s.participantId, score: s.value, name };
          }
        }
        return best;
      }, null);

      if (highestScoringParticipant) {
        facts.push({
          type: "high_score",
          title: "High Scorer",
          description: `${highestScoringParticipant.name} has the highest single-match score in the event (${highestScoringParticipant.score})`,
          severity: "interesting",
          participantIds: [highestScoringParticipant.pid],
        });
      }
    }

    const totalCombined = p1Summary.totalScoreFor + p2Summary.totalScoreFor;
    if (totalCombined > 0) {
      const avgCombined = p1Summary.avgScoreFor + p2Summary.avgScoreFor;
      facts.push({
        type: "probability",
        title: "Predicted Total",
        description: `This match is projected to have ~${Math.round(avgCombined)} total points based on historical averages`,
        severity: "normal",
        participantIds: [p1Summary.participantId, p2Summary.participantId],
      });
    }

    if (p1Summary.totalMatches >= 2 && p2Summary.totalMatches >= 2) {
      const p1Form = p1Summary.last5Results.slice(-3).join(" → ").toUpperCase();
      const p2Form = p2Summary.last5Results.slice(-3).join(" → ").toUpperCase();
      if (p1Form) {
        facts.push({
          type: "form",
          title: "Recent Form",
          description: `${p1Summary.displayName}: ${p1Form} | ${p2Summary.displayName}: ${p2Form}`,
          severity: "normal",
          participantIds: [p1Summary.participantId, p2Summary.participantId],
        });
      }
    }

    return facts;
  }

  calculateWinProbability(
    p1Summary: ParticipantScoreSummary,
    p2Summary: ParticipantScoreSummary,
  ): { p1Win: number; p2Win: number; draw: number } {
    const p1Total = p1Summary.wins + p1Summary.losses;
    const p2Total = p2Summary.wins + p2Summary.losses;

    if (p1Total === 0 && p2Total === 0) {
      return { p1Win: 50, p2Win: 50, draw: 0 };
    }

    const p1WinRate = p1Total > 0 ? p1Summary.wins / p1Total : 0.5;
    const p2WinRate = p2Total > 0 ? p2Summary.wins / p2Total : 0.5;

    const weightedP1 = (p1WinRate * p1Total + 0.5) / (p1Total + 1);
    const weightedP2 = (p2WinRate * p2Total + 0.5) / (p2Total + 1);

    const total = weightedP1 + weightedP2;
    const rawP1 = total > 0 ? (weightedP1 / total) * 100 : 50;
    const rawP2 = total > 0 ? (weightedP2 / total) * 100 : 50;

    const p1Games = p1Summary.totalMatches;
    const p2Games = p2Summary.totalMatches;
    const confidence = Math.min(1, Math.max(p1Games, p2Games) / 10);
    const drawProb = Math.round(Math.max(0, (1 - Math.abs(rawP1 - rawP2) / 100) * 15 * (1 - confidence)));

    return {
      p1Win: Math.round(rawP1 * (100 - drawProb) / 100),
      p2Win: Math.round(rawP2 * (100 - drawProb) / 100),
      draw: drawProb,
    };
  }

  predictScores(p1Summary: ParticipantScoreSummary, p2Summary: ParticipantScoreSummary): { p1: number; p2: number } {
    return {
      p1: Math.round(p1Summary.avgScoreFor * 10) / 10,
      p2: Math.round(p2Summary.avgScoreFor * 10) / 10,
    };
  }

  async getMatchInsight(
    match: Match,
    p1Summary: ParticipantScoreSummary,
    p2Summary: ParticipantScoreSummary,
    allMatches: Match[],
    eventId: ID,
  ): Promise<MatchInsight> {
    const probs = this.calculateWinProbability(p1Summary, p2Summary);
    const predicted = this.predictScores(p1Summary, p2Summary);
    const facts = this.generateFacts(match, p1Summary, p2Summary, allMatches, eventId);

    return {
      matchId: match.id,
      p1WinProb: probs.p1Win,
      p2WinProb: probs.p2Win,
      drawProb: probs.draw,
      p1PredictedScore: predicted.p1,
      p2PredictedScore: predicted.p2,
      facts,
    };
  }
}
