import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
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

    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return NextResponse.json({ error: error.message }, { status: 401 });

    const { data: profileData } = await supabase.from("profiles").select("account_type").eq("id", authData.user.id).single();
    const profile = profileData as unknown as { account_type: "operator" | "team" | "player" } | null;
    let nextPath = "/app";
    if (profile?.account_type === "operator") {
      const { data: membership } = await supabase.from("organization_members").select("organizations(slug)").eq("member_id", authData.user.id).limit(1).maybeSingle();
      const membershipRecord = membership as unknown as { organizations?: { slug?: string } | null } | null;
      const organization = membershipRecord?.organizations;
      if (organization?.slug) nextPath = `/o/${organization.slug}`;
    }

    return NextResponse.json({ ok: true, accountType: profile?.account_type ?? "player", nextPath }, { headers: response.headers });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Login failed" },
      { status: 500 }
    );
  }
}
