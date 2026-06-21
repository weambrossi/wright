import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service-role key. This bypasses RLS,
// so it must NEVER be imported into client components — only API routes.
// Created lazily so a missing env var doesn't crash the build, only requests
// that actually touch the database.
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  // Accept either the secret/service-role key (recommended) or the publishable
  // key. The key only lives here on the server, never in the browser.
  const key =
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY."
    );
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
