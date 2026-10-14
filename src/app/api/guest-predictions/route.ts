import { createHash, randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";
import { calculatePredictionOdds } from "@/domain/prediction-odds";
import type { Match } from "@/domain/match";

const cookieName = "competitionos_guest_predictor";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { matchId?: unknown; participantId?: unknown; name?: unknown };
    const matchId = typeof body.matchId === "string" ? body.matchId : "";
    const participantId = typeof body.participantId === "string" ? body.participantId : "";
    const name = typeof body.name === "string" ? body.name.trim().replace(/\s+/g, " ").slice(0, 48) : "";
    if (!uuidPattern.test(matchId) || !uuidPattern.test(participantId) || name.length < 2) {
      return NextResponse.json({ error: "Enter a display name and choose a valid entrant." }, { status: 400 });
    }

    const supabase = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      cookies: { getAll: () => request.cookies.getAll(), setAll() {} },
    });
    const { data: matchData, error: matchError } = await supabase.from("matches").select("id,event_id,status").eq("id", matchId).maybeSingle();
    const match = matchData as unknown as { id: string; event_id: string; status: string } | null;
    if (matchError || !match) return NextResponse.json({ error: "This fixture is no longer available." }, { status: 404 });
    if (match.status !== "scheduled") return NextResponse.json({ error: "Predictions close when a match starts." }, { status: 409 });
    const { data: entrant, error: entrantError } = await supabase.from("match_participants").select("participant_id").eq("match_id", matchId).eq("participant_id", participantId).maybeSingle();
    if (entrantError || !entrant) return NextResponse.json({ error: "Choose one of the entrants in this fixture." }, { status: 400 });

    const { data: matchRows } = await supabase.from("matches").select("id,event_id,status,winner_id").eq("event_id", match.event_id);
    const eventMatches = (matchRows ?? []) as unknown as { id: string; event_id: string; status: string; winner_id: string | null }[];
    const { data: entrantRows } = eventMatches.length
      ? await supabase.from("match_participants").select("match_id,participant_id").in("match_id", eventMatches.map((row) => row.id))
      : { data: [] };
    const allEntrants = (entrantRows ?? []) as unknown as { match_id: string; participant_id: string }[];
    const history = eventMatches.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      status: row.status,
      result: { winnerId: row.winner_id ?? undefined },
      participantIds: allEntrants.filter((entrantRow) => entrantRow.match_id === row.id).map((entrantRow) => entrantRow.participant_id),
    } as unknown as Match));
    const fixtureEntrants = allEntrants.filter((row) => row.match_id === matchId).map((row) => row.participant_id);
    const market = fixtureEntrants.length === 2 ? calculatePredictionOdds(history, fixtureEntrants[0], fixtureEntrants[1]) : null;
    const odds = market?.[fixtureEntrants.indexOf(participantId)]?.decimalOdds;

    let token = request.cookies.get(cookieName)?.value;
    let newIdentity = false;
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      token = randomBytes(32).toString("hex");
      newIdentity = true;
    }
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const forwardedIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
    const rateSecret = process.env.PREDICTION_RATE_LIMIT_SECRET ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "competitionos-local";
    const ipHash = forwardedIp ? createHmac("sha256", rateSecret).update(forwardedIp.slice(0, 100)).digest("hex") : null;
    // This RPC uses a transaction-level advisory lock, so limits hold across serverless instances.
    const rateClient = supabase as unknown as { rpc: (name: string, values: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
    const { data: allowed, error: rateError } = await rateClient.rpc("consume_guest_prediction_rate_limit", { p_token_hash: tokenHash, p_ip_hash: ipHash });
    if (rateError) {
      console.error("Prediction rate limit unavailable", rateError.message);
      return NextResponse.json({ error: "Predictions are temporarily unavailable. Please try again shortly." }, { status: 503 });
    }
    if (allowed !== true) return NextResponse.json({ error: "Prediction limit reached. Try again later." }, { status: 429, headers: { "Retry-After": "3600" } });
    const { error: insertError } = await supabase.from("bets").insert({
      match_id: matchId,
      event_id: match.event_id,
      participant_id: participantId,
      better_id: null,
      better_name: name,
      guest_token_hash: tokenHash,
      points_wagered: 0,
      decimal_odds: odds ?? null,
    } as never);
    if (insertError?.code === "23505") return NextResponse.json({ error: "You already made a prediction for this fixture." }, { status: 409 });
    if (insertError) return NextResponse.json({ error: "Could not save your prediction. Please try again." }, { status: 500 });

    const response = NextResponse.json({ ok: true, name, matchId, participantId, odds: odds ?? null });
    if (newIdentity) response.cookies.set(cookieName, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    return response;
  } catch {
    return NextResponse.json({ error: "Could not save your prediction." }, { status: 400 });
  }
}
