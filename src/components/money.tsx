'use client';

import { fmtAccounting, fmtMoney, type MoneyOptions } from '@/lib/money';
import { usePrefs } from './prefs';

/**
 * Renders a PKR figure in whichever currency the owner has selected. Every
 * number in the app is computed and stored in rupees; this is display only.
 */
export function Money({
  value,
  accounting = false,
  colour = false,
  ...rest
}: { value: number | null | undefined; accounting?: boolean; colour?: boolean } & Omit<MoneyOptions, 'currency' | 'fxRate'>) {
  const { currency, fxRate } = usePrefs();
  const o: MoneyOptions = { ...rest, currency, fxRate };
  const text = accounting ? fmtAccounting(value, o) : fmtMoney(value, o);
  const style = colour && value != null && Number.isFinite(value) && value !== 0
    ? { color: value > 0 ? 'var(--pos)' : 'var(--neg)' }
    : undefined;
  return <span className="num" style={style}>{text}</span>;
}

/** The unit the figures are in, for column headings. */
export function Unit({ prefix = '' }: { prefix?: string }) {
  const { currency } = usePrefs();
  return <>{prefix}{currency === 'PKR' ? 'Rs' : 'NZ$'}</>;
}
