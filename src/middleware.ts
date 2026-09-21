import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, supabaseConfigured } from '@/lib/supabase/config';

/**
 * Keeps the Supabase session cookie fresh, and sends a signed-out visitor to
 * the sign-in page. With no Supabase project configured there is nothing to
 * sign in to, so everything is let through and the app runs on the seed.
 */
export async function middleware(req: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const db = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value } of list) req.cookies.set(name, value);
        res = NextResponse.next({ request: req });
        for (const { name, value, options } of list) res.cookies.set(name, value, options);
      },
    },
  });

  const { data } = await db.auth.getUser();
  const path = req.nextUrl.pathname;
  const open = path.startsWith('/login') || path.startsWith('/auth') || path.startsWith('/api/cron');
  if (!data.user && !open) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|.*\\.png$|.*\\.svg$).*)'],
};
