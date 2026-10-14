import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  try {
    const { email, password, displayName, accountType, organizationName, teamName, category, teamType } = await request.json();
    if (typeof email !== "string" || typeof password !== "string" || password.length < 6 || typeof displayName !== "string" || displayName.trim().length < 2 || displayName.trim().length > 100) {
      return NextResponse.json({ error: "Enter a valid name, email address, and password" }, { status: 400 });
    }
    if (!['operator', 'team', 'player'].includes(accountType)) {
      return NextResponse.json({ error: "Choose how you will use CompetitionOS" }, { status: 400 });
    }
    if (accountType === "operator" && (!organizationName?.trim() || organizationName.trim().length > 100)) {
      return NextResponse.json({ error: "Enter your organization name" }, { status: 400 });
    }
    if (accountType === "team" && (!teamName?.trim() || teamName.trim().length > 90)) {
      return NextResponse.json({ error: "Enter your team name" }, { status: 400 });
    }
    if (accountType === "team" && (!["football", "futsal", "rugby", "basketball", "cricket", "esports", "combat", "racing", "other"].includes(category) || !["club", "academy", "school", "university", "national", "community", "esports_org"].includes(teamType))) {
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
      email,
      password,
      options: { data: {
        display_name: displayName.trim(),
        account_type: accountType,
        organization_name: accountType === "operator" ? organizationName.trim() : undefined,
        team_name: accountType === "team" ? teamName.trim() : undefined,
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
