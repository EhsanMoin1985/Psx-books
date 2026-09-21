'use client';
import { createBrowserClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';

export function supabaseBrowser() {
  if (!supabaseConfigured) return null;
  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
