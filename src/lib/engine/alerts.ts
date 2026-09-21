import type { Alert, Price, WatchRow } from '../types';
import { r2 } from '../money';

/** An alert level that the latest price has crossed. */
export interface Crossing {
  alert: Alert;
  price: number;
  asOf: string;
  /** How far past the level the price is. */
  by: number;
}

/**
 * Alerts that the latest stored price has crossed.
 *
 * An alert fires once. It stays quiet until it is switched back on, so a price
 * that sits past its level does not send an email at every refresh.
 */
export function crossings(alerts: Alert[], latest: Record<string, { close: number; asOf: string }>): Crossing[] {
  const out: Crossing[] = [];
  for (const a of alerts) {
    if (!a.active || a.fired_at) continue;
    const p = latest[a.symbol];
    if (!p) continue;
    const hit = a.direction === 'above' ? p.close >= a.level : p.close <= a.level;
    if (!hit) continue;
    out.push({ alert: a, price: p.close, asOf: p.asOf, by: r2(Math.abs(p.close - a.level)) });
  }
  return out;
}

export interface WatchStatus extends WatchRow {
  close: number | null;
  asOf: string | null;
  /** Distance to the buy target, as a percentage of the current price. */
  toBuy: number | null;
  toSell: number | null;
  atBuy: boolean;
  atSell: boolean;
  held: number;
}

export function watchStatus(
  watchlist: WatchRow[],
  latest: Record<string, { close: number; asOf: string }>,
  heldQty: Record<string, number>,
): WatchStatus[] {
  return watchlist
    .map((w) => {
      const p = latest[w.symbol] ?? null;
      const close = p?.close ?? null;
      const pct = (target: number | null) => (close && target ? r2(((target - close) / close) * 100) : null);
      return {
        ...w,
        close,
        asOf: p?.asOf ?? null,
        toBuy: pct(w.target_buy),
        toSell: pct(w.target_sell),
        atBuy: close != null && w.target_buy != null && close <= w.target_buy,
        atSell: close != null && w.target_sell != null && close >= w.target_sell,
        held: heldQty[w.symbol] ?? 0,
      };
    })
    .sort((a, b) => Number(b.atBuy || b.atSell) - Number(a.atBuy || a.atSell) || a.symbol.localeCompare(b.symbol));
}

/** The email an alert crossing sends. Plain text, because that is what it is. */
export function alertEmail(crossed: Crossing[], asOf: string) {
  const lines = crossed.map(
    (c) =>
      `${c.alert.symbol}  ${c.alert.direction === 'above' ? 'rose to' : 'fell to'} ${c.price.toFixed(2)}  ` +
      `(alert set ${c.alert.direction} ${c.alert.level.toFixed(2)}, by ${c.by.toFixed(2)})`,
  );
  const subject =
    crossed.length === 1
      ? `PSX Books: ${crossed[0].alert.symbol} ${crossed[0].alert.direction === 'above' ? 'above' : 'below'} ${crossed[0].alert.level.toFixed(2)}`
      : `PSX Books: ${crossed.length} price alerts`;
  const text = [
    `Prices stored at ${asOf}.`,
    '',
    ...lines,
    '',
    'Each alert has been switched off so it does not repeat. Turn it back on in the app to arm it again.',
  ].join('\n');
  return { subject, text };
}
