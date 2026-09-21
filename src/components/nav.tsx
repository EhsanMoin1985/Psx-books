'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePrefs } from './prefs';
import { fmtDate } from '@/lib/money';

export const NAV = [
  { href: '/', label: 'Dashboard', short: 'Home' },
  { href: '/holdings', label: 'Holdings', short: 'Holdings' },
  { href: '/ledger', label: 'Ledger', short: 'Ledger' },
  { href: '/reconcile', label: 'Reconcile', short: 'Recon' },
  { href: '/reports', label: 'Reports', short: 'Reports' },
  { href: '/statements', label: 'Financial statements', short: 'IFRS' },
  { href: '/planner', label: 'Trade planner', short: 'Plan' },
  { href: '/watchlist', label: 'Watchlist and alerts', short: 'Watch' },
  { href: '/settings', label: 'Settings', short: 'More' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function Sidebar({ account }: { account: string }) {
  const pathname = usePathname();
  return (
    <nav
      className="no-print hidden md:flex md:flex-col md:w-56 md:shrink-0 border-r"
      style={{ borderColor: 'var(--line)', background: 'var(--panel)' }}
      aria-label="Sections"
    >
      <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="text-[15px] font-semibold tracking-tight">PSX Books</div>
        <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>{account}</div>
      </div>
      <ul className="flex-1 p-2 space-y-0.5">
        {NAV.map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className="block rounded px-2.5 py-1.5 text-[13px]"
                style={active
                  ? { background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 600 }
                  : { color: 'var(--ink-2)' }}
              >
                {n.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Bottom tab bar for the installed app, clear of the home indicator. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      className="no-print md:hidden fixed inset-x-0 bottom-0 z-20 border-t"
      style={{
        borderColor: 'var(--line)',
        background: 'var(--panel)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="Sections"
    >
      <ul className="grid grid-cols-5">
        {NAV.filter((n) => ['/', '/holdings', '/ledger', '/reports', '/settings'].includes(n.href)).map((n) => {
          const active = isActive(pathname, n.href);
          return (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={active ? 'page' : undefined}
                className="flex flex-col items-center gap-0.5 py-2 text-[11px]"
                style={{ color: active ? 'var(--accent)' : 'var(--ink-3)', fontWeight: active ? 600 : 400 }}
              >
                {n.short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function TopBar({ pricedAt, mode }: { pricedAt: string | null; mode: 'supabase' | 'local' }) {
  const { currency, setCurrency, fxRate, fxAsOf, theme, setTheme } = usePrefs();
  return (
    <header
      className="no-print sticky top-0 z-10 flex items-center gap-3 border-b px-3 py-2 md:px-5"
      style={{ borderColor: 'var(--line)', background: 'var(--panel)', paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      <div className="md:hidden text-[15px] font-semibold">PSX Books</div>
      <div className="hidden md:block text-xs" style={{ color: 'var(--ink-3)' }}>
        {pricedAt ? `Priced at ${fmtDate(pricedAt)}` : 'No prices stored'}
        {mode === 'local' && ' · seed data'}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <div
          className="inline-flex overflow-hidden rounded border text-[12px]"
          style={{ borderColor: 'var(--line-strong)' }}
          role="group"
          aria-label="Display currency"
        >
          {(['PKR', 'NZD'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCurrency(c)}
              aria-pressed={currency === c}
              className="px-2 py-1"
              style={currency === c
                ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 }
                : { background: 'var(--panel)', color: 'var(--ink-2)' }}
            >
              {c}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
          className="rounded border px-2 py-1 text-[12px]"
          style={{ borderColor: 'var(--line-strong)', color: 'var(--ink-2)' }}
          title={`Theme: ${theme}. Tap to change.`}
        >
          {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'Auto'}
        </button>
      </div>
      {currency === 'NZD' && (
        <div className="sr-only">Converted at {fxRate} rupees to the dollar{fxAsOf ? `, ${fxAsOf}` : ''}.</div>
      )}
    </header>
  );
}

/** Shown under the top bar when NZD is selected, so the rate is never implicit. */
export function FxBanner() {
  const { currency, fxRate, fxAsOf } = usePrefs();
  if (currency !== 'NZD') return null;
  return (
    <div
      className="no-print px-3 py-1.5 text-[12px] md:px-5"
      style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}
    >
      Figures converted from rupees at {fxRate.toFixed(2)} to the dollar
      {fxAsOf ? `, the rate stored at ${fmtDate(fxAsOf)}` : ''}. Prices are always entered and held in rupees.
    </div>
  );
}
