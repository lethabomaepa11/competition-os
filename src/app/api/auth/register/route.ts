import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Registration details must be sent as an object" }, { status: 400 });
    }
    const { email, password, displayName, accountType, organizationName, teamName, category, teamType } = body as Record<string, unknown>;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName = typeof displayName === "string" ? displayName.trim() : "";
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail) || typeof password !== "string" || password.length < 6 || typeof displayName !== "string" || normalizedName.length < 2 || normalizedName.length > 100) {
      return NextResponse.json({ error: "Enter a valid name, email address, and password" }, { status: 400 });
    }
    if (typeof accountType !== "string" || !["operator", "team", "player"].includes(accountType)) {
      return NextResponse.json({ error: "Choose how you will use CompetitionOS" }, { status: 400 });
    }
    const normalizedOrganizationName = typeof organizationName === "string" ? organizationName.trim() : "";
    const normalizedTeamName = typeof teamName === "string" ? teamName.trim() : "";
    if (accountType === "operator" && (!normalizedOrganizationName || normalizedOrganizationName.length > 100)) {
      return NextResponse.json({ error: "Enter your organization name" }, { status: 400 });
    }
    if (accountType === "team" && (!normalizedTeamName || normalizedTeamName.length > 90)) {
      return NextResponse.json({ error: "Enter your team name" }, { status: 400 });
    }
    if (accountType === "team" && (typeof category !== "string" || !["football", "futsal", "rugby", "basketball", "cricket", "esports", "combat", "racing", "other"].includes(category) || typeof teamType !== "string" || !["club", "academy", "school", "university", "national", "community", "esports_org"].includes(teamType))) {
      return NextResponse.json({ error: "Choose a valid team category and type" }, { status: 400 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const response = NextResponse.json({ ok: true });
    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    const { error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { data: {
        display_name: normalizedName,
        account_type: accountType,
        organization_name: accountType === "operator" ? normalizedOrganizationName : undefined,
        team_name: accountType === "team" ? normalizedTeamName : undefined,
        category: accountType === "team" ? category : undefined,
        team_type: accountType === "team" ? teamType : undefined,
      } },
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Registration failed" },
      { status: 500 }
    );
  }
}
