import type { Match } from "./match";
import type { Participant } from "./participant";

export interface EventAnalystMetric {
  id: string;
  name: string;
  wins: number;
  draws: number;
  losses: number;
  matches: number;
  averageFor: number;
  averageAgainst: number;
  form: ("W" | "D" | "L")[];
}

/** Derives every analyst input from persisted match outcomes; never accepts client metrics. */
export function computeEventAnalystMetrics(matches: Match[], participants: Participant[]): EventAnalystMetric[] {
  const summaries = new Map(participants.map((participant) => [participant.id, {
    id: participant.id,
    name: participant.displayName.slice(0, 80),
    wins: 0,
    draws: 0,
    losses: 0,
    matches: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    scoredMatches: 0,
    form: [] as ("W" | "D" | "L")[],
  }]));

  for (const match of [...matches].sort((a, b) => (a.result?.finalizedAt ?? a.updatedAt).localeCompare(b.result?.finalizedAt ?? b.updatedAt))) {
    if (match.status !== "completed" || match.participantIds.length !== 2) continue;
    const scores = new Map((match.result?.scores ?? []).map((score) => [score.participantId, score.value]));
    const [firstId, secondId] = match.participantIds;
    const first = summaries.get(firstId);
    const second = summaries.get(secondId);
    if (!first || !second) continue;
    const winnerId = match.result?.winnerId;
    const isDraw = !winnerId && scores.has(firstId) && scores.has(secondId) && scores.get(firstId) === scores.get(secondId);
    if (!winnerId && !isDraw) continue;

    first.matches++;
    second.matches++;
    if (winnerId === firstId) { first.wins++; second.losses++; first.form.push("W"); second.form.push("L"); }
    else if (winnerId === secondId) { second.wins++; first.losses++; first.form.push("L"); second.form.push("W"); }
    else { first.draws++; second.draws++; first.form.push("D"); second.form.push("D"); }

    const firstScore = scores.get(firstId);
    const secondScore = scores.get(secondId);
    if (firstScore !== undefined && secondScore !== undefined) {
      first.scoreFor += firstScore;
      first.scoreAgainst += secondScore;
      second.scoreFor += secondScore;
      second.scoreAgainst += firstScore;
      first.scoredMatches++;
      second.scoredMatches++;
    }
  }

  return [...summaries.values()]
    .map(({ scoreFor, scoreAgainst, scoredMatches, ...metric }) => ({
      ...metric,
      averageFor: scoredMatches ? Number((scoreFor / scoredMatches).toFixed(2)) : 0,
      averageAgainst: scoredMatches ? Number((scoreAgainst / scoredMatches).toFixed(2)) : 0,
      form: metric.form.slice(-5),
    }))
    .sort((a, b) => b.matches - a.matches || b.wins - a.wins || a.name.localeCompare(b.name))
    .slice(0, 8);
}
