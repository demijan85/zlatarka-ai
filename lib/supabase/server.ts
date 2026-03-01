import { createClient } from '@supabase/supabase-js';
import { supabaseAnonKey, supabaseUrl } from './shared';

export function createServerSupabaseClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
