import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: profile } = await supabase.from("profiles").select("account_type").eq("id", user.id).single();
    if (profile?.account_type === "operator") return NextResponse.json({ error: "Tournament applications are for team and player accounts" }, { status: 403 });

    const { data: teams, error: teamError } = await supabase.from("teams").select("id,name,category,team_type,member_ids").contains("member_ids", [user.id]);
    if (teamError) throw teamError;
    const { data: competitions, error: competitionError } = await (supabase.from("competitions") as any).select("id,name,description,category,entry_type,eligibility,published_at,date_start,date_end,organization_id,status,visibility").eq("status", "published").eq("visibility", "public").order("published_at", { ascending: false });
    if (competitionError) throw competitionError;

    const teamIds = (teams ?? []).map((team) => team.id);
    let registrations: Record<string, unknown>[] = [];
    const registrationQuery = (supabase.from("competition_registrations" as never) as any).select("id,competition_id,registrant_type,member_id,team_id,status,created_at");
    const registrationResult = teamIds.length
      ? await registrationQuery.or(`member_id.eq.${user.id},team_id.in.(${teamIds.join(",")})`)
      : await registrationQuery.eq("member_id", user.id);
    if (registrationResult.error) throw registrationResult.error;
    registrations = registrationResult.data ?? [];

    const organizationIds = [...new Set((competitions ?? []).map((item: any) => item.organization_id))];
    const { data: organizations } = organizationIds.length ? await supabase.from("organizations").select("id,name,slug,logo_url").in("id", organizationIds) : { data: [] };
    const organizationMap = new Map((organizations ?? []).map((item) => [item.id, item]));

    const opportunities = (competitions ?? []).map((competition: any) => {
      const eligibleTeams = competition.entry_type === "team" ? (teams ?? []).filter((team) => team.category === competition.category && team.member_ids[0] === user.id) : [];
      const applications = registrations.filter((item) => item.competition_id === competition.id);
      const publishedAt = competition.published_at ?? competition.date_start;
      return {
        id: competition.id,
        name: competition.name,
        description: competition.description,
        category: competition.category,
        entryType: competition.entry_type,
        eligibility: competition.eligibility ?? {},
        dateStart: competition.date_start,
        dateEnd: competition.date_end,
        publishedAt,
        isNew: publishedAt ? Date.now() - new Date(publishedAt).getTime() < 21 * 24 * 60 * 60 * 1000 : false,
        organization: organizationMap.get(competition.organization_id),
        eligibleTeams: eligibleTeams.map((team) => ({ id: team.id, name: team.name, category: team.category, teamType: team.team_type, rosterSize: team.member_ids.length })),
        applications: applications.map((item) => ({ id: item.id, registrantType: item.registrant_type, teamId: item.team_id, memberId: item.member_id, status: item.status, createdAt: item.created_at })),
        canApply: (profile?.account_type === "player" && competition.entry_type === "individual") || (profile?.account_type === "team" && eligibleTeams.length > 0),
      };
    }).filter((competition: { canApply: boolean }) => competition.canApply);

    return NextResponse.json({ data: { opportunities, alertCount: opportunities.filter((item: { isNew: boolean; applications: unknown[] }) => item.isNew && item.applications.length === 0).length } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load eligible competitions" }, { status: 500 }); }
}
