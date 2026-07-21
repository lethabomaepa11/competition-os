import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/types";

type OrganizationRow = Database["public"]["Tables"]["organizations"]["Row"];

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const pendingCookies: { name: string; value: string; options?: Record<string, unknown> }[] = [];

    const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          pendingCookies.length = 0;
          pendingCookies.push(...cookiesToSet);
        },
      },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: memberships, error: memError } = await (supabase.from("organization_members") as any)
      .select("organization_id")
      .eq("member_id", user.id);

    if (memError) return NextResponse.json({ error: (memError as { message: string }).message }, { status: 500 });
    if (!memberships || memberships.length === 0) {
      const response = NextResponse.json({ data: [] });
      for (const { name, value } of pendingCookies) response.cookies.set(name, value);
      return response;
    }

    const orgIds = (memberships as { organization_id: string }[]).map((m) => m.organization_id);

    const { data: organizations, error: orgError } = await (supabase.from("organizations") as any)
      .select("*")
      .in("id", orgIds);

    if (orgError) return NextResponse.json({ error: (orgError as { message: string }).message }, { status: 500 });

    const result = ((organizations ?? []) as OrganizationRow[]).map((o) => ({
      id: o.id,
      name: o.name,
      slug: o.slug,
      logoUrl: o.logo_url,
      settings: o.settings,
      createdAt: o.created_at,
      updatedAt: o.updated_at,
    }));

    const response = NextResponse.json({ data: result });
    for (const { name, value } of pendingCookies) response.cookies.set(name, value);
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
