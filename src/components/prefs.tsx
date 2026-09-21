'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Currency } from '@/lib/money';

type Theme = 'system' | 'light' | 'dark';

interface Prefs {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  fxRate: number;
  fxAsOf: string | null;
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<Prefs | null>(null);

const KEY = 'psx-books:prefs';

export function PrefsProvider({
  children,
  fxRate,
  fxAsOf,
}: {
  children: React.ReactNode;
  fxRate: number;
  fxAsOf: string | null;
}) {
  const [currency, setCurrencyState] = useState<Currency>('PKR');
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return;
      const p = JSON.parse(raw) as { currency?: Currency; theme?: Theme };
      if (p.currency === 'PKR' || p.currency === 'NZD') setCurrencyState(p.currency);
      if (p.theme) setThemeState(p.theme);
    } catch {
      // Private browsing or blocked storage: the defaults are fine.
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(KEY, JSON.stringify({ currency, theme }));
    } catch {
      /* ignore */
    }
  }, [currency, theme]);

  const setCurrency = useCallback((c: Currency) => setCurrencyState(c), []);
  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  const value = useMemo(
    () => ({ currency, setCurrency, fxRate, fxAsOf, theme, setTheme }),
    [currency, setCurrency, fxRate, fxAsOf, theme, setTheme],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs(): Prefs {
  const v = useContext(Ctx);
  if (!v) throw new Error('usePrefs must be used inside PrefsProvider');
  return v;
}
