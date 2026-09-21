import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/** Exchanges the magic link code for a session, then returns to the dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/';
  if (code) {
    const db = await supabaseServer();
    if (db) {
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (error) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin));
      }
    }
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
