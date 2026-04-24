import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

export function setSupabaseSession(access_token, refresh_token) {
  supabase.auth.setSession({ access_token, refresh_token });
}

export function clearSupabaseSession() {
  supabase.auth.signOut();
}

export default supabase;
