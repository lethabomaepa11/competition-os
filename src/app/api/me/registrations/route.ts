import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
}

export async function POST(request: NextRequest) {
  try {
    const supabase = client(request);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
    if (!profile || profile.account_type === "operator") return NextResponse.json({ error: "Operator accounts review registrations; they cannot submit them" }, { status: 403 });
    const body = await request.json() as { competitionId?: string; registrantType?: "individual" | "team"; teamId?: string; note?: string };
    if (!body.competitionId || !body.registrantType) return NextResponse.json({ error: "Competition and registration type are required" }, { status: 400 });
    const { data: competition, error: competitionError } = await (supabase.from("competitions") as any).select("id,name,status,entry_type,category,eligibility").eq("id", body.competitionId).single();
    if (competitionError || !competition) return NextResponse.json({ error: "Competition not found" }, { status: 404 });
    if (competition.status !== "published") return NextResponse.json({ error: "Registration is not open for this competition" }, { status: 409 });
    if (competition.entry_type !== body.registrantType) return NextResponse.json({ error: `This competition accepts ${competition.entry_type === "team" ? "teams" : "individual players"} only` }, { status: 400 });
    if (body.registrantType === "team" && profile.account_type !== "team") return NextResponse.json({ error: "A team account is required" }, { status: 403 });
    if (body.registrantType === "individual" && profile.account_type !== "player") return NextResponse.json({ error: "A player account is required" }, { status: 403 });

    const payload: Record<string, unknown> = { competition_id: competition.id, registrant_type: body.registrantType, registration_note: body.note?.trim().slice(0, 600) ?? "", status: "pending" };
    if (body.registrantType === "individual") {
      payload.member_id = user.id;
    } else {
      if (!body.teamId) return NextResponse.json({ error: "Choose a team" }, { status: 400 });
      const { data: team } = await supabase.from("teams").select("id,name,category,member_ids").eq("id", body.teamId).maybeSingle();
      if (!team || team.member_ids[0] !== user.id) return NextResponse.json({ error: "Only the team captain can submit registration" }, { status: 403 });
      if (team.category !== competition.category) return NextResponse.json({ error: "The team category does not match this competition" }, { status: 400 });
      const minimum = Number(competition.eligibility?.minRosterSize ?? 0);
      const maximum = Number(competition.eligibility?.maxRosterSize ?? 0);
      if (minimum && team.member_ids.length < minimum) return NextResponse.json({ error: `This competition requires at least ${minimum} registered players` }, { status: 400 });
      if (maximum && team.member_ids.length > maximum) return NextResponse.json({ error: `This competition allows at most ${maximum} registered players` }, { status: 400 });
      payload.team_id = team.id;
      payload.member_id = user.id;
    }

    const { data, error } = await (supabase.from("competition_registrations" as never) as any).insert(payload).select("*").single();
    if (error?.code === "23505") return NextResponse.json({ error: "A registration already exists for this entrant" }, { status: 409 });
    if (error) throw error;
    return NextResponse.json({ data }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not submit registration" }, { status: 500 }); }
}
