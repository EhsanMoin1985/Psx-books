/**
 * Money helpers. Everything is stored and computed in PKR; NZD is a display
 * conversion at a stored rate, never a stored figure.
 */

/** Round to 2dp the way a ledger does, avoiding binary float drift on .005 cases. */
export function r2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function r4(n: number): number {
  return Math.round((n + Number.EPSILON) * 10000) / 10000;
}

/** Sum a list of money amounts, rounding at each step so totals foot exactly. */
export function sum(xs: number[]): number {
  return xs.reduce((a, b) => r2(a + b), 0);
}

export type Currency = 'PKR' | 'NZD';

/** PKR uses Indian grouping (lakh/crore). NZD uses ordinary thousands. */
const grouping: Record<Currency, string> = { PKR: 'en-IN', NZD: 'en-NZ' };

export interface MoneyOptions {
  currency?: Currency;
  /** PKR per NZD. Required when currency is NZD. */
  fxRate?: number;
  decimals?: number;
  /** Show a sign even when positive. */
  signed?: boolean;
  /** Render zero as an em dash, as financial statements do. */
  dashZero?: boolean;
}

export function convert(pkr: number, currency: Currency, fxRate?: number): number {
  if (currency === 'PKR') return pkr;
  if (!fxRate || fxRate <= 0) return NaN;
  return pkr / fxRate;
}

/** Format a PKR amount for display, optionally converted to NZD. */
export function fmtMoney(pkr: number | null | undefined, o: MoneyOptions = {}): string {
  const { currency = 'PKR', fxRate, decimals = 2, signed = false, dashZero = false } = o;
  if (pkr == null || !Number.isFinite(pkr)) return '—';
  const v = convert(pkr, currency, fxRate);
  if (!Number.isFinite(v)) return '—';
  if (dashZero && r2(v) === 0) return '—';
  const s = new Intl.NumberFormat(grouping[currency], {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(v));
  const sign = v < 0 ? '-' : signed ? '+' : '';
  return sign + s;
}

/** Negative amounts in brackets, as statements present them. */
export function fmtAccounting(pkr: number | null | undefined, o: MoneyOptions = {}): string {
  if (pkr == null || !Number.isFinite(pkr)) return '—';
  const v = convert(pkr, o.currency ?? 'PKR', o.fxRate);
  const body = fmtMoney(Math.abs(pkr), { ...o, signed: false });
  if (body === '—') return body;
  return v < 0 ? `(${body})` : body;
}

export function fmtQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const whole = Number.isInteger(n);
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: whole ? 0 : 4,
    maximumFractionDigits: whole ? 0 : 4,
  }).format(n);
}

export function fmtPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function fmtPct(n: number | null | undefined, decimals = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n >= 0 ? '' : '-'}${Math.abs(n).toFixed(decimals)}%`;
}

export function currencySymbol(c: Currency): string {
  return c === 'PKR' ? 'Rs' : 'NZ$';
}

/** Short label for a yyyy-mm month key. */
export function fmtMonth(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${names[m - 1]} ${y}`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d).padStart(2, '0')} ${names[m - 1]} ${y}`;
}
