import { createClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';
import type { Database } from '@/types/database.types';

/**
 * Unico punto di accesso a Supabase.
 * Usa solo la anon key: le regole di accesso stanno nelle policy RLS.
 * I componenti non importano questo modulo direttamente, solo gli hook in
 * features/<feature>/api.
 */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storageKey: 'walk-around-auth',
  },
  global: {
    headers: { 'x-application-name': 'walk-around' },
  },
});
