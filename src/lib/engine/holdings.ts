import type { Price, Settings, Txn } from '../types';
import { r2, r4 } from '../money';
import { orderTxns } from './ledger';

/**
 * Holdings on weighted average cost.
 *
 * Two bases are carried side by side and must not be mixed:
 *  - "net"   the books basis. Cost is the signed net amount from the broker
 *            statement, so commission, CVT and exchange levies sit in cost.
 *  - "gross" the IFRS basis. Securities are held for trading, so FVTPL under
 *            IFRS 9: transaction costs are expensed as incurred, never
 *            capitalised, and cost is qty x price only.
 *
 * Units held before the books open (no matching purchase in the data) carry no
 * cost. Their disposals book proceeds and no gain, and are listed separately.
 */

export interface Disposal {
  txnId: string;
  date: string;
  symbol: string;
  qty: number;
  /** Units taken from pre-2026 holdings, which carry no cost. */
  qtyFromOpening: number;
  qtyCosted: number;
  proceedsNet: number;
  proceedsGross: number;
  /** Proceeds attributable to pre-2026 units. No gain is booked on these. */
  proceedsOpening: number;
  costRelieved: number;
  costRelievedGross: number;
  gainNet: number;
  gainGross: number;
  transactionCost: number;
}

export interface Holding {
  symbol: string;
  qty: number;
  /** Units still held that were carried in before the books open. */
  openingQty: number;
  /** Books cost of the costed units. */
  cost: number;
  costGross: number;
  /** Deemed cost of opening units at their 31 Dec 2025 price, when one is stored. */
  openingCost: number | null;
  /** Books cost including any deemed opening cost. Null where opening cost is unknown. */
  totalCost: number | null;
  avgCost: number | null;
  close: number | null;
  asOf: string | null;
  marketValue: number | null;
  unrealised: number | null;
  unrealisedPct: number | null;
  realised: number;
  proceedsNoCost: number;
}

export interface Book {
  holdings: Holding[];
  closed: Holding[];
  disposals: Disposal[];
  /** Units per symbol carried in before the books open. */
  opening: Record<string, number>;
  realisedNet: number;
  realisedGross: number;
  proceedsNoCost: number;
  transactionCosts: number;
  costTotal: number;
  costGrossTotal: number;
  marketValueTotal: number;
  unrealisedTotal: number;
  /** True when every held symbol has a price to mark against. */
  fullyPriced: boolean;
}

/** Gross consideration of a trade: qty x price, before commission and levies. */
export function grossOf(t: Txn): number {
  if (t.qty == null || t.price == null) return Math.abs(t.amount);
  return r2(t.qty * t.price);
}

/** Commission, CVT and exchange levies: the gap between gross and the net amount. */
export function transactionCostOf(t: Txn): number {
  const gross = grossOf(t);
  if (t.type === 'BUY') return r2(Math.abs(t.amount) - gross);
  if (t.type === 'SELL') return r2(gross - t.amount);
  return 0;
}

/**
 * Units per symbol that must have been held before the books open, being the
 * deepest a symbol's running quantity goes below zero.
 */
export function inferOpeningQty(txns: Txn[]): Record<string, number> {
  const run: Record<string, number> = {};
  const deficit: Record<string, number> = {};
  for (const t of orderTxns(txns)) {
    if (!t.symbol || t.qty == null) continue;
    run[t.symbol] ??= 0;
    deficit[t.symbol] ??= 0;
    if (t.type === 'BUY') run[t.symbol] = r4(run[t.symbol] + t.qty);
    if (t.type === 'SELL') run[t.symbol] = r4(run[t.symbol] - t.qty);
    if (run[t.symbol] < -deficit[t.symbol]) deficit[t.symbol] = -run[t.symbol];
  }
  const out: Record<string, number> = {};
  for (const [s, d] of Object.entries(deficit)) if (d > 0) out[s] = d;
  return out;
}

export function latestPrices(prices: Price[], settings: Settings): Record<string, { close: number; asOf: string }> {
  const out: Record<string, { close: number; asOf: string }> = {};
  for (const p of prices) {
    const cur = out[p.symbol];
    if (!cur || p.as_of > cur.asOf) out[p.symbol] = { close: p.close, asOf: p.as_of };
  }
  // Prices captured in the settings document are a fallback only; a row in
  // `prices` for the same symbol always wins, whatever its date.
  const px = settings.prices?.px ?? {};
  const asOf = settings.prices?.asOf ?? {};
  for (const [s, close] of Object.entries(px)) {
    if (!out[s]) out[s] = { close, asOf: asOf[s] ?? settings.prices?.updated?.slice(0, 10) ?? '' };
  }
  return out;
}

interface Pool {
  qty: number;
  openingQty: number;
  cost: number;
  costGross: number;
  realised: number;
  realisedGross: number;
  proceedsNoCost: number;
}

export function buildBook(txns: Txn[], prices: Price[], settings: Settings): Book {
  const opening = inferOpeningQty(txns);
  const pools: Record<string, Pool> = {};
  const disposals: Disposal[] = [];
  let transactionCosts = 0;

  const pool = (s: string): Pool =>
    (pools[s] ??= {
      qty: opening[s] ?? 0,
      openingQty: opening[s] ?? 0,
      cost: 0,
      costGross: 0,
      realised: 0,
      realisedGross: 0,
      proceedsNoCost: 0,
    });

  for (const t of orderTxns(txns)) {
    if (!t.symbol || t.qty == null) continue;
    const p = pool(t.symbol);
    const gross = grossOf(t);
    const tc = transactionCostOf(t);

    if (t.type === 'BUY') {
      transactionCosts = r2(transactionCosts + tc);
      p.qty = r4(p.qty + t.qty);
      p.cost = r2(p.cost + Math.abs(t.amount));
      p.costGross = r2(p.costGross + gross);
      continue;
    }
    if (t.type !== 'SELL') continue;

    transactionCosts = r2(transactionCosts + tc);
    // Pre-2026 units are the oldest, so they go first.
    const qtyFromOpening = Math.min(p.openingQty, t.qty);
    const qtyCosted = r4(t.qty - qtyFromOpening);
    const share = (v: number, q: number) => (t.qty ? r2((v * q) / t.qty!) : 0);
    const proceedsOpening = share(t.amount, qtyFromOpening);
    const proceedsNet = share(t.amount, qtyCosted);
    const proceedsGross = share(gross, qtyCosted);

    const costedQty = r4(p.qty - p.openingQty);
    const avgNet = costedQty > 0 ? p.cost / costedQty : 0;
    const avgGross = costedQty > 0 ? p.costGross / costedQty : 0;
    const costRelieved = r2(avgNet * qtyCosted);
    const costRelievedGross = r2(avgGross * qtyCosted);

    const gainNet = qtyCosted > 0 ? r2(proceedsNet - costRelieved) : 0;
    const gainGross = qtyCosted > 0 ? r2(proceedsGross - costRelievedGross) : 0;

    disposals.push({
      txnId: t.id,
      date: t.trade_date,
      symbol: t.symbol,
      qty: t.qty,
      qtyFromOpening,
      qtyCosted,
      proceedsNet,
      proceedsGross,
      proceedsOpening,
      costRelieved,
      costRelievedGross,
      gainNet,
      gainGross,
      transactionCost: tc,
    });

    p.openingQty = r4(p.openingQty - qtyFromOpening);
    p.proceedsNoCost = r2(p.proceedsNoCost + proceedsOpening);
    p.cost = r2(p.cost - costRelieved);
    p.costGross = r2(p.costGross - costRelievedGross);
    p.qty = r4(p.qty - t.qty);
    p.realised = r2(p.realised + gainNet);
    p.realisedGross = r2(p.realisedGross + gainGross);
  }

  const px = latestPrices(prices, settings);
  const openingPx = settings.openingPrices ?? {};
  const all: Holding[] = Object.entries(pools).map(([symbol, p]) => {
    const mark = px[symbol] ?? null;
    const openingCost = p.openingQty > 0 ? (openingPx[symbol] != null ? r2(openingPx[symbol] * p.openingQty) : null) : 0;
    const totalCost = openingCost == null ? null : r2(p.cost + openingCost);
    const marketValue = mark && p.qty > 0 ? r2(mark.close * p.qty) : null;
    const unrealised = marketValue != null && totalCost != null ? r2(marketValue - totalCost) : null;
    return {
      symbol,
      qty: p.qty,
      openingQty: p.openingQty,
      cost: p.cost,
      costGross: p.costGross,
      openingCost,
      totalCost,
      avgCost: p.qty > 0 && totalCost != null ? r4(totalCost / p.qty) : null,
      close: mark?.close ?? null,
      asOf: mark?.asOf ?? null,
      marketValue,
      unrealised,
      unrealisedPct: unrealised != null && totalCost ? r2((unrealised / totalCost) * 100) : null,
      realised: p.realised,
      proceedsNoCost: p.proceedsNoCost,
    };
  });

  const holdings = all.filter((h) => h.qty > 0).sort((a, b) => (b.marketValue ?? 0) - (a.marketValue ?? 0));
  const closed = all.filter((h) => h.qty <= 0).sort((a, b) => a.symbol.localeCompare(b.symbol));

  return {
    holdings,
    closed,
    disposals,
    opening,
    realisedNet: disposals.reduce((a, d) => r2(a + d.gainNet), 0),
    realisedGross: disposals.reduce((a, d) => r2(a + d.gainGross), 0),
    proceedsNoCost: disposals.reduce((a, d) => r2(a + d.proceedsOpening), 0),
    transactionCosts,
    costTotal: holdings.reduce((a, h) => r2(a + (h.totalCost ?? h.cost)), 0),
    costGrossTotal: holdings.reduce((a, h) => r2(a + h.costGross), 0),
    marketValueTotal: holdings.reduce((a, h) => r2(a + (h.marketValue ?? 0)), 0),
    unrealisedTotal: holdings.reduce((a, h) => r2(a + (h.unrealised ?? 0)), 0),
    fullyPriced: holdings.every((h) => h.close != null),
  };
}

/** Every trade in one symbol, oldest first, with the running position. */
export function symbolLedger(txns: Txn[], symbol: string) {
  const opening = inferOpeningQty(txns)[symbol] ?? 0;
  let qty = opening;
  let cost = 0;
  let openingQty = opening;
  const rows = orderTxns(txns)
    .filter((t) => t.symbol === symbol && t.qty != null)
    .map((t) => {
      if (t.type === 'BUY') {
        qty = r4(qty + t.qty!);
        cost = r2(cost + Math.abs(t.amount));
      } else if (t.type === 'SELL') {
        const fromOpening = Math.min(openingQty, t.qty!);
        const costed = r4(t.qty! - fromOpening);
        const costedQty = r4(qty - openingQty);
        const avg = costedQty > 0 ? cost / costedQty : 0;
        cost = r2(cost - r2(avg * costed));
        openingQty = r4(openingQty - fromOpening);
        qty = r4(qty - t.qty!);
      }
      return { ...t, runningQty: qty, runningCost: cost, avgCost: qty > 0 ? r4(cost / qty) : null };
    });
  return { opening, rows };
}
