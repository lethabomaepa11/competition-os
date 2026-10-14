import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type Score = { participantId?: string; participant_id?: string; value?: number; score?: number };

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => request.cookies.getAll(), setAll() {} },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: participantRows, error: participantError } = await supabase.from("participants").select("*").eq("member_id", user.id);
    if (participantError) throw participantError;
    const participants = participantRows ?? [];
    if (!participants.length) return NextResponse.json({ data: { summary: { events: 0, played: 0, wins: 0, draws: 0, losses: 0, winRate: 0, scored: 0, conceded: 0 }, entries: [], recentMatches: [] } });

    const participantIds = participants.map((item) => item.id);
    const eventIds = [...new Set(participants.map((item) => item.event_id))];
    const [{ data: events }, { data: links }] = await Promise.all([
      supabase.from("events").select("*").in("id", eventIds),
      supabase.from("match_participants").select("*").in("participant_id", participantIds),
    ]);
    const matchIds = [...new Set((links ?? []).map((item) => item.match_id))];
    const { data: matches } = matchIds.length ? await supabase.from("matches").select("*").in("id", matchIds).order("scheduled_at", { ascending: false }) : { data: [] };
    const allEventIds = [...new Set((matches ?? []).map((item) => item.event_id))];
    const allEvents = events ?? [];
    if (allEventIds.some((id) => !allEvents.some((event) => event.id === id))) {
      const { data } = await supabase.from("events").select("*").in("id", allEventIds);
      for (const event of data ?? []) if (!allEvents.some((item) => item.id === event.id)) allEvents.push(event);
    }
    const competitionIds = [...new Set(allEvents.map((item) => item.competition_id))];
    const { data: competitions } = competitionIds.length ? await supabase.from("competitions").select("id,name,organization_id").in("id", competitionIds) : { data: [] };
    const organizationIds = [...new Set((competitions ?? []).map((item) => item.organization_id))];
    const { data: organizations } = organizationIds.length ? await supabase.from("organizations").select("id,name,slug").in("id", organizationIds) : { data: [] };

    const eventMap = new Map(allEvents.map((item) => [item.id, item]));
    const competitionMap = new Map((competitions ?? []).map((item) => [item.id, item]));
    const organizationMap = new Map((organizations ?? []).map((item) => [item.id, item]));
    const participantMap = new Map(participants.map((item) => [item.id, item]));
    const totals = { events: participants.length, played: 0, wins: 0, draws: 0, losses: 0, scored: 0, conceded: 0 };

    const recentMatches = (matches ?? []).map((match) => {
      const link = (links ?? []).find((item) => item.match_id === match.id && participantMap.has(item.participant_id));
      const participant = link ? participantMap.get(link.participant_id) : undefined;
      const scores = Array.isArray(match.scores) ? match.scores as Score[] : [];
      const own = scores.find((score) => (score.participantId ?? score.participant_id) === participant?.id);
      const ownScore = Number(own?.value ?? own?.score ?? link?.score ?? 0);
      const otherScore = scores.filter((score) => (score.participantId ?? score.participant_id) !== participant?.id).reduce((sum, score) => sum + Number(score.value ?? score.score ?? 0), 0);
      const complete = match.status === "completed" || match.status === "walkover";
      let result: "win" | "draw" | "loss" | "scheduled" = "scheduled";
      if (complete) {
        totals.played += 1; totals.scored += ownScore; totals.conceded += otherScore;
        if (match.winner_id === participant?.id) { result = "win"; totals.wins += 1; }
        else if (!match.winner_id) { result = "draw"; totals.draws += 1; }
        else { result = "loss"; totals.losses += 1; }
      }
      const event = eventMap.get(match.event_id);
      const competition = event ? competitionMap.get(event.competition_id) : undefined;
      const organization = competition ? organizationMap.get(competition.organization_id) : undefined;
      return { id: match.id, participantId: participant?.id, displayName: participant?.display_name, eventName: event?.name ?? "Event", competitionName: competition?.name ?? "Competition", organizationName: organization?.name ?? "Organization", organizationSlug: organization?.slug ?? "", competitionId: competition?.id ?? "", scheduledAt: match.scheduled_at, status: match.status, ownScore, otherScore, result };
    });

    return NextResponse.json({ data: { summary: { ...totals, winRate: totals.played ? Math.round((totals.wins / totals.played) * 100) : 0 }, entries: participants.map((participant) => { const event = eventMap.get(participant.event_id); const competition = event ? competitionMap.get(event.competition_id) : undefined; return { participantId: participant.id, displayName: participant.display_name, status: participant.status, seed: participant.seed, eventName: event?.name ?? "Event", eventStatus: event?.status ?? "draft", competitionName: competition?.name ?? "Competition" }; }), recentMatches: recentMatches.slice(0, 12) } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load performance" }, { status: 500 });
  }
}
