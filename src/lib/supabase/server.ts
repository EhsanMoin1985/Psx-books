import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from './config';

/** A Supabase client bound to the request's cookies, so RLS sees the signed-in owner. */
export async function supabaseServer() {
  if (!supabaseConfigured) return null;
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies cannot be set. The
          // middleware refreshes the session instead.
        }
      },
    },
  });
}

/** A client that bypasses the user session, for the scheduled job only. */
export function supabaseService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfigured || !key) return null;
  const { createClient } = require('@supabase/supabase-js') as typeof import('@supabase/supabase-js');
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}
