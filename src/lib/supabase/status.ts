export type SupabaseReadiness = {
  mode: "local" | "supabase-ready";
  hasUrl: boolean;
  hasAnonKey: boolean;
  url: string | null;
  localApiUrl: string;
  localStudioUrl: string;
};

export function getSupabaseReadiness(): SupabaseReadiness {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const hasUrl = url.trim().length > 0;
  const hasAnonKey = anonKey.trim().length > 0;

  return {
    mode: hasUrl && hasAnonKey ? "supabase-ready" : "local",
    hasUrl,
    hasAnonKey,
    url: hasUrl ? url : null,
    localApiUrl: "http://127.0.0.1:54321",
    localStudioUrl: "http://127.0.0.1:54323",
  };
}
