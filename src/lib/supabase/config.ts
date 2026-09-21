export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** True once a Supabase project is configured. Until then the app runs on the seed. */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
