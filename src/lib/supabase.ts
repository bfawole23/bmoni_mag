/*
 * BMONI Embedded — Supabase client (lazy, env-gated).
 *
 * Mode rules from the build plan:
 *   · The browser holds ONLY the anon key. RLS scopes every row to auth.uid().
 *   · The service role key NEVER ships in this bundle — it belongs to the
 *     Phase 2 FastAPI backend, which will own webhooks and cross-user writes.
 *   · When the env vars are absent, the app runs on the local sandbox ledger
 *     (Phase 1 default) — nothing else changes.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const url = env.VITE_SUPABASE_URL?.trim();
const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseMode = (): boolean => Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!client) {
    if (!url || !anonKey) {
      throw new Error("Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
    }
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return client;
}
