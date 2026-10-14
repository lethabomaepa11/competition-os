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

export interface EventAnalystContext {
  metrics: EventAnalystMetric[];
  standingsMovement: { participantId: string; name: string; from: number; to: number; change: number }[];
  headToHead: { participants: [string, string]; names: [string, string]; meetings: number; wins: [number, number]; draws: number }[];
  qualification: { participantId: string; name: string; rank: number; points: number; remaining: number; maxPoints: number; status: "clinched" | "open" | "eliminated" }[];
}

function pointsTable(matches: Match[], participants: Participant[]) {
  const rows = new Map(participants.map((participant) => [participant.id, { id: participant.id, name: participant.displayName.slice(0, 80), points: 0, difference: 0 }]));
  for (const match of matches) {
    if (match.status !== "completed" || match.participantIds.length !== 2 || !match.result) continue;
    const [firstId, secondId] = match.participantIds;
    const first = rows.get(firstId);
    const second = rows.get(secondId);
    if (!first || !second) continue;
    const scores = new Map(match.result.scores.map((score) => [score.participantId, score.value]));
    first.difference += (scores.get(firstId) ?? 0) - (scores.get(secondId) ?? 0);
    second.difference += (scores.get(secondId) ?? 0) - (scores.get(firstId) ?? 0);
    if (match.result.winnerId === firstId) first.points += 3;
    else if (match.result.winnerId === secondId) second.points += 3;
    else { first.points++; second.points++; }
  }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.difference - a.difference || a.name.localeCompare(b.name));
}

/** Builds deterministic analyst evidence, including movement and qualification ranges. */
export function computeEventAnalystContext(matches: Match[], participants: Participant[], qualificationSlots = 0): EventAnalystContext {
  const completed = [...matches].filter((match) => match.status === "completed" && match.participantIds.length === 2 && match.result)
    .sort((a, b) => (a.result?.finalizedAt ?? a.updatedAt).localeCompare(b.result?.finalizedAt ?? b.updatedAt));
  const current = pointsTable(completed, participants);
  const previous = pointsTable(completed.slice(0, -1), participants);
  const oldRank = new Map(previous.map((row, index) => [row.id, index + 1]));
  const standingsMovement = current.map((row, index) => ({ participantId: row.id, name: row.name, from: oldRank.get(row.id) ?? index + 1, to: index + 1, change: (oldRank.get(row.id) ?? index + 1) - (index + 1) }))
    .filter((row) => row.change !== 0).sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 8);

  const names = new Map(participants.map((participant) => [participant.id, participant.displayName.slice(0, 80)]));
  const pairs = new Map<string, { ids: [string, string]; meetings: number; wins: [number, number]; draws: number }>();
  for (const match of completed) {
    const ids = [...match.participantIds].sort() as [string, string];
    const key = ids.join(":");
    const row = pairs.get(key) ?? { ids, meetings: 0, wins: [0, 0], draws: 0 };
    row.meetings++;
    if (match.result?.winnerId === ids[0]) row.wins[0]++;
    else if (match.result?.winnerId === ids[1]) row.wins[1]++;
    else row.draws++;
    pairs.set(key, row);
  }
  const headToHead = [...pairs.values()].sort((a, b) => b.meetings - a.meetings).slice(0, 8).map((row) => ({ participants: row.ids, names: [names.get(row.ids[0]) ?? "Entrant", names.get(row.ids[1]) ?? "Entrant"] as [string, string], meetings: row.meetings, wins: row.wins, draws: row.draws }));

  const remaining = new Map(participants.map((participant) => [participant.id, 0]));
  for (const match of matches) {
    if (!["scheduled", "in_progress", "disputed"].includes(match.status)) continue;
    for (const id of match.participantIds) remaining.set(id, (remaining.get(id) ?? 0) + 1);
  }
  const slots = Math.min(Math.max(0, Math.floor(qualificationSlots)), current.length);
  const cutoff = slots ? current[slots - 1]?.points ?? 0 : 0;
  const qualification = slots ? current.map((row, index) => {
    const games = remaining.get(row.id) ?? 0;
    const maxPoints = row.points + games * 3;
    const bestOutsideMaximum = Math.max(-1, ...current.slice(slots).filter((other) => other.id !== row.id).map((other) => other.points + (remaining.get(other.id) ?? 0) * 3));
    const status = index < slots && row.points > bestOutsideMaximum ? "clinched" : index >= slots && maxPoints < cutoff ? "eliminated" : "open";
    return { participantId: row.id, name: row.name, rank: index + 1, points: row.points, remaining: games, maxPoints, status } as const;
  }) : [];

  return { metrics: computeEventAnalystMetrics(matches, participants), standingsMovement, headToHead, qualification };
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
