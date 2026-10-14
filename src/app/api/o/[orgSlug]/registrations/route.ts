import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

type RegistrationRow = { id: string; competition_id: string; registrant_type: "team" | "individual"; team_id: string | null; member_id: string | null; status: string; registration_note: string; review_note: string; created_at: string };

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
}

async function operatorContext(request: NextRequest, orgSlug: string) {
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: organization } = await supabase.from("organizations").select("id,name,slug").eq("slug", orgSlug).maybeSingle();
  if (!organization) return { error: NextResponse.json({ error: "Organization not found" }, { status: 404 }) };
  const { data: membership } = await supabase.from("organization_members").select("role").eq("organization_id", organization.id).eq("member_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin", "moderator"].includes(membership.role)) return { error: NextResponse.json({ error: "Operator access required" }, { status: 403 }) };
  return { supabase, user, organization };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params;
    const context = await operatorContext(request, orgSlug);
    if (context.error) return context.error;
    const { supabase, organization } = context;
    // Generated types do not yet include the additive marketplace table.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as { from: (table: string) => any };
    const { data: competitions } = await supabase.from("competitions").select("id,name,category,entry_type").eq("organization_id", organization.id);
    const competitionIds = (competitions ?? []).map((item) => item.id);
    if (!competitionIds.length) return NextResponse.json({ data: { items: [], total: 0, page: 1, pageSize: 10 } });
    const requestedPage = Number(request.nextUrl.searchParams.get("page") ?? 1);
    const requestedSize = Number(request.nextUrl.searchParams.get("pageSize") ?? 10);
    const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
    const pageSize = Number.isFinite(requestedSize) ? Math.min(100, Math.max(1, Math.floor(requestedSize))) : 10;
    let query = db.from("competition_registrations").select("*", { count: "exact" }).in("competition_id", competitionIds).order("created_at", { ascending: false });
    const status = request.nextUrl.searchParams.get("status");
    if (status) query = query.eq("status", status);
    const search = request.nextUrl.searchParams.get("search")?.trim().slice(0, 100);
    if (search) {
      const safeSearch = search.replace(/[%_,()]/g, " ");
      const [{ data: matchingCompetitions }, { data: matchingTeams }, { data: matchingProfiles }] = await Promise.all([
        supabase.from("competitions").select("id").in("id", competitionIds).ilike("name", `%${safeSearch}%`).limit(100),
        supabase.from("teams").select("id").ilike("name", `%${safeSearch}%`).limit(100),
        supabase.from("profiles").select("id").or(`display_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%`).limit(100),
      ]);
      const terms = [
        ...(matchingCompetitions ?? []).map((item) => `competition_id.eq.${item.id}`),
        ...(matchingTeams ?? []).map((item) => `team_id.eq.${item.id}`),
        ...(matchingProfiles ?? []).map((item) => `member_id.eq.${item.id}`),
      ];
      if (!terms.length) return NextResponse.json({ data: { items: [], total: 0, page, pageSize } });
      query = query.or(terms.join(","));
    }
    const from = (page - 1) * pageSize;
    const { data: registrations, error, count } = await query.range(from, from + pageSize - 1);
    if (error) throw error;
    const registrationRows = (registrations ?? []) as RegistrationRow[];
    const teamIds = [...new Set(registrationRows.map((item) => item.team_id).filter(Boolean))] as string[];
    const memberIds = [...new Set(registrationRows.map((item) => item.member_id).filter(Boolean))] as string[];
    const [{ data: teams }, { data: profiles }, { data: events }] = await Promise.all([
      teamIds.length ? supabase.from("teams").select("id,name,category,team_type,member_ids").in("id", teamIds) : Promise.resolve({ data: [] }),
      memberIds.length ? supabase.from("profiles").select("id,email,display_name").in("id", memberIds) : Promise.resolve({ data: [] }),
      supabase.from("events").select("id,competition_id,name,participant_type,status,max_participants").in("competition_id", competitionIds),
    ]);
    const competitionMap = new Map((competitions ?? []).map((item) => [item.id, item]));
    const teamMap = new Map((teams ?? []).map((item) => [item.id, item]));
    const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
    return NextResponse.json({ data: { items: registrationRows.map((item) => ({ id: item.id, competition: competitionMap.get(item.competition_id), registrantType: item.registrant_type, team: teamMap.get(item.team_id ?? ""), member: profileMap.get(item.member_id ?? ""), status: item.status, registrationNote: item.registration_note, reviewNote: item.review_note, createdAt: item.created_at, targetEvents: (events ?? []).filter((event) => event.competition_id === item.competition_id && event.participant_type === item.registrant_type).map((event) => ({ id: event.id, name: event.name, status: event.status })) })), total: count ?? 0, page, pageSize } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load registrations" }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params;
    const context = await operatorContext(request, orgSlug);
    if (context.error) return context.error;
    const { supabase, user, organization } = context;
    // Generated types do not yet include the additive marketplace table.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as unknown as { from: (table: string) => any };
    const body = await request.json() as { registrationId?: string; status?: "approved" | "rejected"; reviewNote?: string };
    if (!body.registrationId || !body.status || !["approved", "rejected"].includes(body.status)) return NextResponse.json({ error: "Registration and decision are required" }, { status: 400 });
    const { data: registration } = await db.from("competition_registrations").select("*").eq("id", body.registrationId).maybeSingle();
    if (!registration) return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    const { data: competition } = await supabase.from("competitions").select("id,organization_id").eq("id", registration.competition_id).maybeSingle();
    if (!competition || competition.organization_id !== organization.id) return NextResponse.json({ error: "Registration does not belong to this organization" }, { status: 403 });
    if (registration.status !== "pending") return NextResponse.json({ error: "This registration has already been reviewed" }, { status: 409 });

    const { data: updated, error: updateError } = await db.from("competition_registrations").update({ status: body.status, review_note: body.reviewNote?.trim().slice(0, 600) ?? "", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", registration.id).select("*").single();
    if (updateError) throw updateError;

    let provisioned = 0;
    if (body.status === "approved") {
      const { data: events } = await supabase.from("events").select("id,name,participant_type,max_participants").eq("competition_id", competition.id).eq("participant_type", registration.registrant_type);
      let displayName = "Approved entrant";
      if (registration.registrant_type === "team") {
        const { data: team } = await supabase.from("teams").select("name").eq("id", registration.team_id).maybeSingle();
        displayName = team?.name ?? displayName;
      } else {
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", registration.member_id).maybeSingle();
        displayName = profile?.display_name ?? displayName;
      }
      for (const event of events ?? []) {
        let existingQuery = supabase.from("participants").select("id", { count: "exact", head: false }).eq("event_id", event.id);
        existingQuery = registration.registrant_type === "team" ? existingQuery.eq("team_id", registration.team_id) : existingQuery.eq("member_id", registration.member_id);
        const { data: existing } = await existingQuery.limit(1);
        if (existing?.length) continue;
        const { count } = await supabase.from("participants").select("id", { count: "exact", head: true }).eq("event_id", event.id).eq("status", "active");
        if (event.max_participants && (count ?? 0) >= event.max_participants) continue;
        const { error } = await supabase.from("participants").insert({ event_id: event.id, member_id: registration.member_id, team_id: registration.team_id, display_name: displayName, status: "active", registered_at: new Date().toISOString() });
        if (!error) provisioned += 1;
      }
    }
    return NextResponse.json({ data: { registration: updated, provisioned } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not review registration" }, { status: 500 }); }
}
