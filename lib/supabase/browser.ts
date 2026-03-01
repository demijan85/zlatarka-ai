'use client';

import { createBrowserClient } from '@supabase/ssr';
import { supabaseAnonKey, supabaseUrl } from './shared';

export function createBrowserSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
