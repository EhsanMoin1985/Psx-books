import type { Price } from '../types';

/**
 * Where a price came from.
 *
 * PSX licenses its market data and prohibits redistribution, so the portal is
 * never scraped. The default adapter takes a paste from the owner's own
 * InvestPro portfolio screen; a licensed vendor feed can be added later
 * without anything else in the app changing.
 */
export interface PriceQuote {
  symbol: string;
  close: number;
  lastTrade?: number | null;
  asOf: string;
}

export interface PriceSource {
  readonly id: string;
  readonly label: string;
  /** False when the source needs a human to paste figures in. */
  readonly automatic: boolean;
  /** Reasons the source cannot run right now, e.g. a missing key. */
  unavailable(): string | null;
  fetch(symbols: string[], asOf: string): Promise<PriceQuote[]>;
}

/** Today in Pakistan Standard Time (UTC+5), which is the trading day. */
export function pktDate(now: Date = new Date()): string {
  return new Date(now.getTime() + 5 * 3600_000).toISOString().slice(0, 10);
}

export function isTradingDay(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * Parses a paste from a portfolio or quote screen. Accepts CSV, tab separated
 * or whitespace separated rows of "SYMBOL price [date]", ignoring anything it
 * cannot read rather than guessing.
 */
export function parsePasted(text: string, defaultAsOf: string): { quotes: PriceQuote[]; skipped: string[] } {
  const quotes: PriceQuote[] = [];
  const skipped: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw) continue;
    const parts = raw.split(/[,\t]|\s{2,}|\s+/).filter(Boolean);
    if (parts.length < 2) {
      skipped.push(raw);
      continue;
    }
    const symbol = parts[0].toUpperCase().replace(/[^A-Z0-9.]/g, '');
    const close = Number(parts[1].replace(/,/g, ''));
    if (!symbol || !Number.isFinite(close) || close <= 0) {
      skipped.push(raw);
      continue;
    }
    const maybeDate = parts.find((p) => /^\d{4}-\d{2}-\d{2}$/.test(p));
    quotes.push({ symbol, close, asOf: maybeDate ?? defaultAsOf });
  }
  return { quotes, skipped };
}

/** The default source: figures the owner pastes in. */
export class ManualPriceSource implements PriceSource {
  readonly id = 'manual';
  readonly label = 'Manual paste or import';
  readonly automatic = false;
  constructor(private readonly pasted = '') {}
  unavailable() {
    return this.pasted.trim() ? null : 'No figures have been pasted in.';
  }
  async fetch(symbols: string[], asOf: string): Promise<PriceQuote[]> {
    const { quotes } = parsePasted(this.pasted, asOf);
    const wanted = new Set(symbols);
    return symbols.length ? quotes.filter((q) => wanted.has(q.symbol)) : quotes;
  }
}

/**
 * A licensed vendor feed, configured by environment variables. Left inactive
 * until a vendor is chosen, so the cron job falls back to the manual source
 * and says so rather than inventing prices.
 */
export class VendorPriceSource implements PriceSource {
  readonly id = 'vendor';
  readonly label = process.env.PRICE_VENDOR_NAME ?? 'Licensed vendor feed';
  readonly automatic = true;
  unavailable() {
    if (!process.env.PRICE_VENDOR_URL) return 'PRICE_VENDOR_URL is not set.';
    if (!process.env.PRICE_VENDOR_KEY) return 'PRICE_VENDOR_KEY is not set.';
    return null;
  }
  async fetch(symbols: string[], asOf: string): Promise<PriceQuote[]> {
    const why = this.unavailable();
    if (why) throw new Error(why);
    const url = new URL(process.env.PRICE_VENDOR_URL!);
    url.searchParams.set('symbols', symbols.join(','));
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${process.env.PRICE_VENDOR_KEY}` },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`${this.label} returned ${res.status}`);
    const body = (await res.json()) as { symbol: string; close: number; last?: number; asOf?: string }[];
    return body
      .filter((q) => Number.isFinite(q.close) && q.close > 0)
      .map((q) => ({ symbol: q.symbol.toUpperCase(), close: q.close, lastTrade: q.last ?? null, asOf: q.asOf ?? asOf }));
  }
}

export function resolveSource(pasted?: string): PriceSource {
  const vendor = new VendorPriceSource();
  if (!vendor.unavailable()) return vendor;
  return new ManualPriceSource(pasted ?? '');
}

export function quotesToPrices(quotes: PriceQuote[], sourceId: string): Price[] {
  return quotes.map((q) => ({
    symbol: q.symbol,
    as_of: q.asOf,
    close: q.close,
    last_trade: q.lastTrade ?? null,
    source: sourceId,
  }));
}
