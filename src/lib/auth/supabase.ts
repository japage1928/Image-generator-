import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && publishableKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !publishableKey) throw new Error("Authentication is not configured yet.");
  client ??= createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}

export async function getSession(): Promise<Session | null> {
  if (!supabaseConfigured) return null;
  const { data, error } = await getSupabase().auth.getSession();
  if (error) throw error;
  return data.session;
}

export type AuthState = { session: Session | null; user: User | null };
