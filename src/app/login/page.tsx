import { LoginForm } from '@/components/login-form';
import { Note, Panel } from '@/components/ui';
import { supabaseConfigured } from '@/lib/supabase/config';

export const metadata = { title: 'Sign in' };
export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  // Only ever redirect back inside this app, never to a URL someone supplied.
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-[22px] font-semibold">Sign in</h1>
      <p className="mb-5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
        PSX Books is a single-owner book. Signing in sends a link to the owner&apos;s email address; there is no password
        to remember or lose.
      </p>
      {error && (
        <div className="mb-4">
          <Note tone="warn">
            <p className="font-medium" style={{ color: 'var(--ink)' }}>That sign-in link did not work.</p>
            <p className="mt-1">{error}</p>
            <p className="mt-1.5">
              The usual cause is opening the link in a different browser or on a different device from the one that asked
              for it, which the sign-in flow cannot carry across. Ask for a new link below and open it on this device. A
              link that has already been used, or is more than an hour old, will also fail.
            </p>
          </Note>
        </div>
      )}
      <Panel>
        {supabaseConfigured ? (
          <LoginForm next={safeNext} />
        ) : (
          <Note tone="warn">
            No Supabase project is configured, so there is nothing to sign in to. The app is running on the seed file and
            every screen is open. Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and{' '}
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to turn authentication on.
          </Note>
        )}
      </Panel>
    </div>
  );
}
