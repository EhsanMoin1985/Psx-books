import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Exchanges the magic link code for a session, then returns the owner to
 * wherever they were headed.
 *
 * A failure sends them back to the sign-in page with the reason, rather than to
 * a page the middleware will only bounce again.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const raw = url.searchParams.get('next') ?? '/';
  // Only ever redirect back inside this app, never to a URL someone supplied.
  const next = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';

  const bounce = (reason: string) =>
    NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(reason)}&next=${encodeURIComponent(next)}`, url.origin),
    );

  if (!code) {
    const described = url.searchParams.get('error_description') ?? url.searchParams.get('error');
    return bounce(described ?? 'The link carried no sign-in code.');
  }

  const db = await supabaseServer();
  if (!db) return bounce('No Supabase project is configured.');

  const { error } = await db.auth.exchangeCodeForSession(code);
  if (error) return bounce(error.message);

  return NextResponse.redirect(new URL(next, url.origin));
}
