import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { currentPassword, newPassword } = await request.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const response = NextResponse.json({ ok: true });
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });

    if (currentPassword) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (signInError) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 403 });
      }
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to change password" },
      { status: 500 }
    );
  }
}
