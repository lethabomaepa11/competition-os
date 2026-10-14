import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SPORT_CATEGORIES, TEAM_TYPES } from "@/domain/categories";

function client(request: NextRequest) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
}

async function getUser(request: NextRequest) {
  const supabase = client(request);
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

async function getAccountType(supabase: ReturnType<typeof client>, userId: string) {
  const { data } = await supabase.from("profiles").select("account_type").eq("id", userId).single();
  return data?.account_type ?? "player";
}

async function expandTeams(supabase: ReturnType<typeof client>, teams: { id: string; name: string; member_ids: string[]; avatar_url: string | null; category: string; team_type: string; description: string; created_at: string; updated_at: string }[], userId: string) {
  const ids = [...new Set(teams.flatMap((team) => team.member_ids))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id,email,display_name,avatar_url").in("id", ids) : { data: [] };
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  return teams.map((team) => ({ id: team.id, name: team.name, avatarUrl: team.avatar_url, category: team.category, teamType: team.team_type, description: team.description, createdAt: team.created_at, updatedAt: team.updated_at, canManage: team.member_ids[0] === userId, members: team.member_ids.map((id, index) => ({ ...profileMap.get(id), id, captain: index === 0 })) }));
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (await getAccountType(supabase, user.id) === "operator") return NextResponse.json({ error: "Operator accounts do not have a team workspace" }, { status: 403 });
    const { data, error } = await supabase.from("teams").select("*").contains("member_ids", [user.id]).order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ data: await expandTeams(supabase, data ?? [], user.id) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load teams" }, { status: 500 }); }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (await getAccountType(supabase, user.id) !== "team") return NextResponse.json({ error: "A team account is required" }, { status: 403 });
    const { count } = await supabase.from("teams").select("id", { count: "exact", head: true }).contains("member_ids", [user.id]);
    if ((count ?? 0) > 0) return NextResponse.json({ error: "This account already owns its team" }, { status: 409 });
    const { name, category, teamType, description } = await request.json();
    if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 90) return NextResponse.json({ error: "Team names must contain 2 to 90 characters" }, { status: 400 });
    if (!SPORT_CATEGORIES.some((item) => item.value === category)) return NextResponse.json({ error: "Select a valid team category" }, { status: 400 });
    if (!TEAM_TYPES.some((item) => item.value === teamType)) return NextResponse.json({ error: "Select a valid team type" }, { status: 400 });
    const { data, error } = await supabase.from("teams").insert({ name: name.trim(), category, team_type: teamType, description: typeof description === "string" ? description.trim().slice(0, 500) : "", member_ids: [user.id] }).select("*").single();
    if (error) throw error;
    return NextResponse.json({ data: (await expandTeams(supabase, [data], user.id))[0] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create team" }, { status: 500 }); }
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await getUser(request);
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (await getAccountType(supabase, user.id) !== "team") return NextResponse.json({ error: "A team account is required" }, { status: 403 });
    const body = await request.json() as { teamId?: string; action?: "rename" | "update" | "add" | "remove"; name?: string; category?: string; teamType?: string; description?: string; email?: string; memberId?: string };
    if (!body.teamId) return NextResponse.json({ error: "Team is required" }, { status: 400 });
    if (!body.action || !["rename", "update", "add", "remove"].includes(body.action)) return NextResponse.json({ error: "A valid roster action is required" }, { status: 400 });
    const { data: team, error: teamError } = await supabase.from("teams").select("*").eq("id", body.teamId).single();
    if (teamError || !team) return NextResponse.json({ error: "Team not found" }, { status: 404 });
    if (team.member_ids[0] !== user.id) return NextResponse.json({ error: "Only the team captain can manage this roster" }, { status: 403 });
    let memberIds = [...team.member_ids];
    let name = team.name;
    let category = team.category;
    let teamType = team.team_type;
    let description = team.description;
    if (body.action === "rename") {
      if (!body.name?.trim() || body.name.trim().length > 90) return NextResponse.json({ error: "Team names must contain 1 to 90 characters" }, { status: 400 });
      name = body.name.trim();
    } else if (body.action === "update") {
      if (!body.name?.trim() || body.name.trim().length > 90) return NextResponse.json({ error: "Team names must contain 1 to 90 characters" }, { status: 400 });
      if (!SPORT_CATEGORIES.some((item) => item.value === body.category)) return NextResponse.json({ error: "Select a valid team category" }, { status: 400 });
      if (!TEAM_TYPES.some((item) => item.value === body.teamType)) return NextResponse.json({ error: "Select a valid team type" }, { status: 400 });
      name = body.name.trim(); category = body.category; teamType = body.teamType; description = body.description?.trim().slice(0, 500) ?? "";
    } else if (body.action === "add") {
      if (!body.email) return NextResponse.json({ error: "Player email is required" }, { status: 400 });
      const { data: profile } = await supabase.from("profiles").select("id").ilike("email", body.email.trim()).maybeSingle();
      if (!profile) return NextResponse.json({ error: "No CompetitionOS account uses that email" }, { status: 404 });
      if (!memberIds.includes(profile.id)) memberIds.push(profile.id);
    } else if (body.action === "remove") {
      if (!body.memberId || body.memberId === user.id) return NextResponse.json({ error: "The captain cannot remove themselves" }, { status: 400 });
      memberIds = memberIds.filter((id) => id !== body.memberId);
    }
    const { data, error } = await supabase.from("teams").update({ name, category, team_type: teamType, description, member_ids: memberIds }).eq("id", team.id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ data: (await expandTeams(supabase, [data], user.id))[0] });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update team" }, { status: 500 }); }
}
