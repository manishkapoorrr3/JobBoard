// Supabase service-role client (server-only).
//
// This client uses the SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level
// Security. It must NEVER be imported into client components or exposed to the
// browser. Only import it from route handlers / server code that runs on the
// Node.js runtime.
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string | undefined;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string | undefined;

let cached: SupabaseClient | null = null;

/**
 * Returns a singleton Supabase client authenticated with the service-role key.
 * Throws if the required env vars are missing — callers should guard with
 * `isAdminConfigured()` (or their own check) before calling this in a code path
 * that must degrade gracefully to demo behavior.
 */
export function getServiceSupabase(): SupabaseClient {
  if (cached) return cached;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Service Supabase client is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    );
  }
  cached = createClient(supabaseUrl, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return cached;
}

/**
 * True when the server has everything it needs to run privileged admin flows:
 * the Supabase URL, the service-role key, and an admin PIN. When false, callers
 * should degrade gracefully (return 503 / demo behavior) instead of throwing.
 */
export function isAdminConfigured(): boolean {
  return Boolean(supabaseUrl && serviceKey && process.env.ADMIN_PIN);
}
