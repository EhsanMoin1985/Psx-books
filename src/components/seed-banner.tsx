import { Note } from './ui';

/**
 * Says so plainly when the app is running on the seed file rather than the
 * owner's Supabase project, because on the seed nothing that is typed lasts.
 */
export function SeedBanner({ mode }: { mode: 'supabase' | 'local' }) {
  if (mode === 'supabase') return null;
  return (
    <div className="mb-4 no-print">
      <Note tone="warn">
        <p>
          Running on the seed file: the 61 real transactions and the settings shipped with the repository. Every figure
          on every screen is computed from that data, but anything you add or change lasts only until the server
          restarts.
        </p>
        <p className="mt-1.5">
          To keep your work, connect a Supabase project: run <code>schema.sql</code> in it, then set{' '}
          <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>. Sign in and the dashboard
          will offer to load the book for you; no terminal and no service key are needed.{' '}
          <strong>SETUP.md</strong> has the click-by-click version.
        </p>
      </Note>
    </div>
  );
}
