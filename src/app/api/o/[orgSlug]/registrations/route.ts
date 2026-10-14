import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
    const { data: competitions } = await supabase.from("competitions").select("id,name,category,entry_type").eq("organization_id", organization.id);
    const competitionIds = (competitions ?? []).map((item) => item.id);
    if (!competitionIds.length) return NextResponse.json({ data: [] });
    let query = (supabase.from("competition_registrations" as never) as any).select("*").in("competition_id", competitionIds).order("created_at", { ascending: false });
    const status = request.nextUrl.searchParams.get("status");
    if (status) query = query.eq("status", status);
    const { data: registrations, error } = await query;
    if (error) throw error;
    const teamIds = [...new Set((registrations ?? []).map((item: any) => item.team_id).filter(Boolean))] as string[];
    const memberIds = [...new Set((registrations ?? []).map((item: any) => item.member_id).filter(Boolean))] as string[];
    const [{ data: teams }, { data: profiles }, { data: events }] = await Promise.all([
      teamIds.length ? supabase.from("teams").select("id,name,category,team_type,member_ids").in("id", teamIds) : Promise.resolve({ data: [] }),
      memberIds.length ? supabase.from("profiles").select("id,email,display_name").in("id", memberIds) : Promise.resolve({ data: [] }),
      supabase.from("events").select("id,competition_id,name,participant_type,status,max_participants").in("competition_id", competitionIds),
    ]);
    const competitionMap = new Map((competitions ?? []).map((item) => [item.id, item]));
    const teamMap = new Map((teams ?? []).map((item) => [item.id, item]));
    const profileMap = new Map((profiles ?? []).map((item) => [item.id, item]));
    return NextResponse.json({ data: (registrations ?? []).map((item: any) => ({ id: item.id, competition: competitionMap.get(item.competition_id), registrantType: item.registrant_type, team: teamMap.get(item.team_id), member: profileMap.get(item.member_id), status: item.status, registrationNote: item.registration_note, reviewNote: item.review_note, createdAt: item.created_at, targetEvents: (events ?? []).filter((event) => event.competition_id === item.competition_id && event.participant_type === item.registrant_type).map((event) => ({ id: event.id, name: event.name, status: event.status })) })) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load registrations" }, { status: 500 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orgSlug: string }> }) {
  try {
    const { orgSlug } = await params;
    const context = await operatorContext(request, orgSlug);
    if (context.error) return context.error;
    const { supabase, user, organization } = context;
    const body = await request.json() as { registrationId?: string; status?: "approved" | "rejected"; reviewNote?: string };
    if (!body.registrationId || !body.status || !["approved", "rejected"].includes(body.status)) return NextResponse.json({ error: "Registration and decision are required" }, { status: 400 });
    const { data: registration } = await (supabase.from("competition_registrations" as never) as any).select("*").eq("id", body.registrationId).maybeSingle();
    if (!registration) return NextResponse.json({ error: "Registration not found" }, { status: 404 });
    const { data: competition } = await supabase.from("competitions").select("id,organization_id").eq("id", registration.competition_id).maybeSingle();
    if (!competition || competition.organization_id !== organization.id) return NextResponse.json({ error: "Registration does not belong to this organization" }, { status: 403 });
    if (registration.status !== "pending") return NextResponse.json({ error: "This registration has already been reviewed" }, { status: 409 });

    const { data: updated, error: updateError } = await (supabase.from("competition_registrations" as never) as any).update({ status: body.status, review_note: body.reviewNote?.trim().slice(0, 600) ?? "", reviewed_by: user.id, reviewed_at: new Date().toISOString() }).eq("id", registration.id).select("*").single();
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
