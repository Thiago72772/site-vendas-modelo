import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getOrCreateSessionId } from '@/lib/session';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '';

if (!supabaseUrl || !supabasePublishableKey) {
  console.error(
    'Missing Supabase environment variables. Ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set in .env.local'
  );
}

/**
 * Inject the anonymous session ID into every Supabase request
 * as a custom header. Postgres RLS policies can read this via
 * current_setting('request.headers') to enforce per-session
 * access control on anonymous queries.
 *
 * On startup we also call setAuth() with the session ID so that
 * Realtime channels are scoped correctly.
 */
const sessionId = getOrCreateSessionId();

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabasePublishableKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'x-session-id': sessionId,
      },
    },
  }
);