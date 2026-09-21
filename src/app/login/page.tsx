import { LoginForm } from '@/components/login-form';
import { Note, Panel } from '@/components/ui';
import { supabaseConfigured } from '@/lib/supabase/config';

export const metadata = { title: 'Sign in' };

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-[22px] font-semibold">Sign in</h1>
      <p className="mb-5 text-[13px]" style={{ color: 'var(--ink-2)' }}>
        PSX Books is a single-owner book. Signing in sends a link to the owner&apos;s email address; there is no password
        to remember or lose.
      </p>
      <Panel>
        {supabaseConfigured ? (
          <LoginForm />
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
