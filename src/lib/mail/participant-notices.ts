import type { Round, Stage } from "@/domain/event";
import type { Match } from "@/domain/match";
import { getFormat } from "@/domain/formats/registry";
import { MatchStatus, type FormatType } from "@/domain/types";
import type { MailEventPayload } from "./templates";

export type ParticipantNotification =
  | { type: "match_scheduled" | "match_started" | "match_result"; matchId: string }
  | { type: "bracket_generated"; stageId: string };

export interface NoticeContact {
  displayName: string;
  status: string;
  email: string | null;
}

/** One email for one entrant; `key` makes delivery idempotent. */
export interface ParticipantNotice {
  key: string;
  participantId: string;
  mail: Omit<MailEventPayload, "to">;
}

export interface NoticeContext {
  eventName: string;
  liveUrl: string;
  timeZone?: string;
  stages: Stage[];
  rounds: Round[];
  matches: Match[];
  contacts: Map<string, NoticeContact>;
}

const KNOCKOUT_STAGES = new Set(["single_elimination", "double_elimination"]);

function formatWhen(iso: string, timeZone?: string): string | undefined {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const options: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZoneName: "short" };
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(date);
  }
}

function details(rows: [string, string | undefined][]): { label: string; value: string }[] {
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }));
}

class Notices {
  constructor(private readonly ctx: NoticeContext) {}

  name(participantId?: string): string {
    return this.ctx.contacts.get(participantId ?? "")?.displayName.trim() || "TBD";
  }

  isActive(participantId: string): boolean {
    return this.ctx.contacts.get(participantId)?.status === "active";
  }

  stageOf(match: Match): { round?: Round; stage?: Stage } {
    const round = this.ctx.rounds.find((r) => r.id === match.roundId);
    return { round, stage: this.ctx.stages.find((s) => s.id === round?.stageId) };
  }

  /** "Group C" for group fixtures, otherwise the round, e.g. "Semi-Final". */
  label(match: Match): string {
    const group = match.config?.groupName as string | undefined;
    if (group) return `Group ${group}`;
    const round = this.stageOf(match).round?.name ?? (match.config?.roundName as string | undefined) ?? "Match";
    return round.replace(/-Finals\b/i, "-Final");
  }

  players(match: Match): string[] {
    return [...match.participants].sort((a, b) => a.position - b.position).map((p) => p.participantId);
  }

  /** Each active player paired with their opponent. */
  pairs(match: Match): [string, string][] {
    const [a, b] = this.players(match);
    if (!a || !b) return [];
    return ([[a, b], [b, a]] as [string, string][]).filter(([player]) => this.isActive(player));
  }

  matchName(match: Match): string {
    return this.players(match).map((id) => this.name(id)).join(" vs ");
  }

  schedule(match: Match): { when?: string; venue?: string } {
    return {
      when: match.scheduledAt ? formatWhen(match.scheduledAt, this.ctx.timeZone) : undefined,
      venue: match.venue || undefined,
    };
  }

  mail(kind: MailEventPayload["kind"], params: MailEventPayload["params"], rows: [string, string | undefined][]): Omit<MailEventPayload, "to"> {
    return {
      kind,
      actionUrl: this.ctx.liveUrl,
      params: { eventName: this.ctx.eventName, actionLabel: "Follow it live", ...params },
      details: details(rows),
    };
  }

  scheduled(match: Match): ParticipantNotice[] {
    const { when, venue } = this.schedule(match);
    if (!when && !venue) return [];
    return this.pairs(match).map(([player, opponent]) => ({
      key: `match_scheduled:${match.id}:${match.scheduledAt ?? ""}:${venue ?? ""}:${player}`,
      participantId: player,
      mail: this.mail("player_match_scheduled", {
        matchName: this.matchName(match),
        message: `${this.name(player)}, your ${this.label(match)} match against ${this.name(opponent)} is scheduled${when ? ` for ${when}` : ""}${venue ? ` at ${venue}` : ""}.`,
      }, [["Opponent", this.name(opponent)], ["Stage", this.label(match)], ["When", when], ["Venue", venue], ["Event", this.ctx.eventName]]),
    }));
  }

  started(match: Match): ParticipantNotice[] {
    if (match.status !== MatchStatus.InProgress) return [];
    const { venue } = this.schedule(match);
    return this.pairs(match).map(([player, opponent]) => ({
      key: `match_started:${match.id}:${match.startedAt ?? ""}:${player}`,
      participantId: player,
      mail: this.mail("player_match_started", {
        matchName: this.matchName(match),
        message: `${this.name(player)}, you're up! Your ${this.label(match)} match against ${this.name(opponent)} is starting now — please make your way to play${venue ? ` at ${venue}` : ""}.`,
      }, [["Opponent", this.name(opponent)], ["Stage", this.label(match)], ["Venue", venue], ["Event", this.ctx.eventName]]),
    }));
  }

  /** Knockout matches in the same stage, with every completed result carried forward. */
  propagatedStage(match: Match): Match[] | undefined {
    const { stage } = this.stageOf(match);
    if (!stage || !KNOCKOUT_STAGES.has(stage.type)) return undefined;
    const stageRounds = this.ctx.rounds.filter((r) => r.stageId === stage.id);
    const roundIds = new Set(stageRounds.map((r) => r.id));
    return getFormat(stage.type as FormatType).propagateResults(this.ctx.matches.filter((m) => roundIds.has(m.roundId)), stageRounds);
  }

  pendingMatchFor(propagated: Match[] | undefined, played: Match, participantId: string): Match | undefined {
    return propagated?.find((m) => m.id !== played.id
      && (m.status === MatchStatus.Scheduled || m.status === MatchStatus.InProgress)
      && m.participantIds.includes(participantId));
  }

  result(match: Match): ParticipantNotice[] {
    if (match.status !== MatchStatus.Completed || !match.result) return [];
    const { winnerId } = match.result;
    const scores = new Map(match.result.scores.map((s) => [s.participantId, s.value]));
    const [first, second] = this.players(match);
    const scoreline = scores.size > 0
      ? `${this.name(first)} ${scores.get(first) ?? 0}–${scores.get(second) ?? 0} ${this.name(second)}`
      : this.matchName(match);
    const propagated = this.propagatedStage(match);
    const label = this.label(match);
    const thirdPlace = !!match.config?.thirdPlace;

    return this.pairs(match).map(([player, opponent]) => {
      const score = scores.size > 0 ? ` ${scores.get(player) ?? 0}–${scores.get(opponent) ?? 0}` : "";
      const outcome = winnerId === player ? "Won" : winnerId ? "Lost" : "Draw";
      let message = outcome === "Won"
        ? `Well played, ${this.name(player)}! You beat ${this.name(opponent)}${score} in your ${label} match.`
        : outcome === "Lost"
          ? `${this.name(player)}, you lost${score} to ${this.name(opponent)} in your ${label} match.`
          : `${this.name(player)}, your ${label} match against ${this.name(opponent)} ended in a${score} draw.`;
      let next: string | undefined;
      if (propagated) {
        const upcoming = this.pendingMatchFor(propagated, match, player);
        if (upcoming) {
          next = this.label(upcoming);
          message += outcome === "Won"
            ? ` You're through to the ${next} — your opponent will be confirmed by email.`
            : ` Your run continues in the ${next} — your opponent will be confirmed by email.`;
        } else if (thirdPlace) {
          next = outcome === "Won" ? "Third place" : "Fourth place";
          message += ` You finish in ${next.toLowerCase()} — thank you for playing.`;
        } else if (outcome === "Won") {
          next = "Champion";
          message += ` Congratulations — you are the ${this.ctx.eventName} champion!`;
        } else {
          next = "Eliminated";
          message += " That's the end of your run — thank you for playing.";
        }
      }
      return {
        key: `match_result:${match.id}:${match.result?.finalizedAt ?? match.updatedAt}:${player}`,
        participantId: player,
        mail: this.mail("player_match_result", { matchName: this.matchName(match), scoreline, message },
          [["Result", outcome], ["Score", score.trim() || undefined], ["Opponent", this.name(opponent)], ["Stage", label], ["Next", next]]),
      };
    });
  }

  /** Emails both players of any knockout match whose line-up this result completed. */
  nextOpponents(match: Match): ParticipantNotice[] {
    const propagated = this.propagatedStage(match);
    if (!propagated) return [];
    const players = new Set(match.participantIds);
    return propagated
      .filter((m) => m.id !== match.id && m.status === MatchStatus.Scheduled
        && m.participantIds.length === 2 && m.participantIds.some((id) => players.has(id)))
      .flatMap((upcoming) => {
        const { when, venue } = this.schedule(upcoming);
        const lineup = [...upcoming.participantIds].sort().join(":");
        return this.pairs(upcoming).map(([player, opponent]) => ({
          key: `match_ready:${upcoming.id}:${lineup}:${player}`,
          participantId: player,
          mail: this.mail("player_next_match", {
            matchName: this.matchName(upcoming),
            message: `${this.name(player)}, your next opponent is confirmed: you'll face ${this.name(opponent)} in the ${this.label(upcoming)}.${when ? ` It's scheduled for ${when}${venue ? ` at ${venue}` : ""}.` : " We'll email you again when it's time to play."}`,
          }, [["Opponent", this.name(opponent)], ["Stage", this.label(upcoming)], ["When", when], ["Venue", venue], ["Event", this.ctx.eventName]]),
        }));
      });
  }

  bracket(stageId: string): ParticipantNotice[] {
    const stage = this.ctx.stages.find((s) => s.id === stageId);
    if (!stage) return [];
    const firstRound = this.ctx.rounds.filter((r) => r.stageId === stage.id).sort((a, b) => a.roundNumber - b.roundNumber)[0];
    if (!firstRound) return [];
    const notices: ParticipantNotice[] = [];
    const qualified = new Set<string>();

    for (const match of this.ctx.matches.filter((m) => m.roundId === firstRound.id)) {
      const players = this.players(match);
      const { when, venue } = this.schedule(match);
      for (const player of players) {
        qualified.add(player);
        if (!this.isActive(player)) continue;
        const opponent = players.find((id) => id !== player);
        const round = firstRound.name;
        notices.push({
          key: `bracket:${stage.id}:${player}`,
          participantId: player,
          mail: this.mail("player_qualified", {
            roundName: round,
            message: opponent
              ? `Congratulations ${this.name(player)}, you've qualified for the knockout stage of ${this.ctx.eventName}! Your ${this.label(match)} opponent is ${this.name(opponent)}.`
              : `Congratulations ${this.name(player)}, you've qualified for the knockout stage of ${this.ctx.eventName} with a bye into the next round.`,
          }, [["Round", round], ["Opponent", opponent ? this.name(opponent) : "Bye"], ["When", when], ["Venue", venue]]),
        });
      }
    }

    // Right after the groups, everyone else hears that the bracket is set.
    const previous = this.ctx.stages.find((s) => s.orderIndex === stage.orderIndex - 1);
    if (previous?.type === "group_stage") {
      for (const participantId of this.ctx.contacts.keys()) {
        if (qualified.has(participantId) || !this.isActive(participantId)) continue;
        notices.push({
          key: `bracket:${stage.id}:${participantId}`,
          participantId,
          mail: this.mail("player_not_qualified", {
            message: `${this.name(participantId)}, the group stage of ${this.ctx.eventName} is complete and the knockout bracket is set. You didn't make it through this time — thank you for playing, and follow the knockouts live.`,
          }, []),
        });
      }
    }
    return notices;
  }
}

/** Builds the emails for one operator action; pure, so it can be checked without sending mail. */
export function buildParticipantNotices(ctx: NoticeContext, notification: ParticipantNotification): ParticipantNotice[] {
  const notices = new Notices(ctx);
  if (notification.type === "bracket_generated") return notices.bracket(notification.stageId);
  const match = ctx.matches.find((m) => m.id === notification.matchId);
  if (!match) return [];
  if (notification.type === "match_scheduled") return notices.scheduled(match);
  if (notification.type === "match_started") return notices.started(match);
  return [...notices.result(match), ...notices.nextOpponents(match)];
}
