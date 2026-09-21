import type { Settings, Txn } from '../types';
import { r2, r4 } from '../money';
import type { Book } from './holdings';
import { grossOf, transactionCostOf } from './holdings';
import { CGT_RATE } from './reports';

/**
 * Trade planner: what an order would cost and what it would do to the book,
 * worked out before it is placed with the broker.
 *
 * Commission and levy rates are derived from the owner's own trade history
 * rather than assumed, so they follow the broker's actual tariff.
 */

export interface TariffRates {
  commissionPct: number;
  leviesPct: number;
  /** Trades the rates were derived from. Zero means the defaults are in use. */
  sample: number;
}

/** JS Global's tariff over the period in the books. */
const DEFAULT_TARIFF: TariffRates = { commissionPct: 0.15, leviesPct: 0.0345, sample: 0 };

export function deriveTariff(txns: Txn[]): TariffRates {
  let gross = 0;
  let commission = 0;
  let levies = 0;
  let sample = 0;
  for (const t of txns) {
    if (t.type !== 'BUY' && t.type !== 'SELL') continue;
    if (t.qty == null || t.price == null || !t.commission) continue;
    const g = grossOf(t);
    if (g <= 0) continue;
    gross = r2(gross + g);
    commission = r2(commission + t.commission);
    levies = r2(levies + transactionCostOf(t) - t.commission);
    sample += 1;
  }
  if (!sample || gross <= 0) return DEFAULT_TARIFF;
  return {
    commissionPct: r4((commission / gross) * 100),
    leviesPct: r4((levies / gross) * 100),
    sample,
  };
}

export interface PlanDraft {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  limitPrice: number | null;
}

export interface PlanCosting {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  price: number | null;
  gross: number;
  commission: number;
  levies: number;
  /** Signed, the way the row would land in the cash book. */
  netAmount: number;
  /** BUY: cash left after settling. SELL: cash after receipt. */
  cashAfter: number;
  /** BUY only: true when the order exceeds available cash. */
  shortfall: number;
  /** SELL only: cost relieved at weighted average, the gain, and tax on it. */
  costRelieved: number | null;
  gain: number | null;
  cgtEstimate: number | null;
  /** Units held now, and after the order fills. */
  qtyBefore: number;
  qtyAfter: number;
  /** SELL only: true when it would sell more than is held. */
  oversold: boolean;
  /** Share of the portfolio this symbol holds now and would hold after. */
  weightBefore: number | null;
  weightAfter: number | null;
  sector: string | null;
  sectorWeightBefore: number | null;
  sectorWeightAfter: number | null;
  tariff: TariffRates;
  warnings: string[];
}

export const DEFAULT_SECTORS: Record<string, string> = {
  ATRL: 'Refinery',
  BAFL: 'Commercial banks',
  UBL: 'Commercial banks',
  MEBL: 'Commercial banks',
  NBP: 'Commercial banks',
  JSBL: 'Commercial banks',
  NATF: 'Food and personal care',
  SEARL: 'Pharmaceuticals',
  KEL: 'Power generation',
  PIAHCLA: 'Transport',
  PSX: 'Financial exchange',
  JSGBETF: 'Exchange traded fund',
};

export function sectorOf(symbol: string, settings: Settings): string | null {
  return settings.sectors?.[symbol] ?? DEFAULT_SECTORS[symbol] ?? null;
}

export function costPlan(
  draft: PlanDraft,
  book: Book,
  cash: number,
  txns: Txn[],
  settings: Settings,
): PlanCosting {
  const tariff = deriveTariff(txns);
  const held = book.holdings.find((h) => h.symbol === draft.symbol);
  const price = draft.limitPrice ?? held?.close ?? null;
  const qty = Math.max(0, draft.qty);
  const gross = price != null ? r2(qty * price) : 0;
  const commission = r2((gross * tariff.commissionPct) / 100);
  const levies = r2((gross * tariff.leviesPct) / 100);
  const warnings: string[] = [];

  if (price == null) warnings.push('No limit price and no stored price for this symbol, so the costing is blank.');
  if (!qty) warnings.push('Quantity is zero.');

  const netAmount = draft.side === 'BUY' ? r2(-(gross + commission + levies)) : r2(gross - commission - levies);
  const cashAfter = r2(cash + netAmount);
  const shortfall = draft.side === 'BUY' && cashAfter < 0 ? r2(-cashAfter) : 0;
  if (shortfall > 0) warnings.push('The order costs more than the cash available at the broker.');

  const qtyBefore = held?.qty ?? 0;
  const qtyAfter = draft.side === 'BUY' ? r4(qtyBefore + qty) : r4(qtyBefore - qty);
  const oversold = draft.side === 'SELL' && qty > qtyBefore;
  if (oversold) warnings.push('The order sells more units than the book holds.');

  let costRelieved: number | null = null;
  let gain: number | null = null;
  let cgtEstimate: number | null = null;
  if (draft.side === 'SELL' && held && qtyBefore > 0 && qty > 0) {
    const sellable = Math.min(qty, qtyBefore);
    // The full-precision average, not the rounded one shown on screen, so the
    // estimate matches the cost the ledger will actually relieve.
    const avg = (held.totalCost ?? held.cost) / held.qty;
    costRelieved = r2(avg * sellable);
    gain = r2(r2(gross - commission - levies) * (sellable / qty) - costRelieved);
    cgtEstimate = gain > 0 ? r2(gain * CGT_RATE) : 0;
  }

  // Weights are measured against the portfolio as it would stand after the order.
  const mvBefore = book.marketValueTotal;
  const symBefore = held?.marketValue ?? 0;
  const mark = price ?? held?.close ?? null;
  const symAfter = mark != null ? r2(mark * Math.max(qtyAfter, 0)) : symBefore;
  const mvAfter = r2(mvBefore - symBefore + symAfter);
  const pct = (part: number, whole: number) => (whole > 0 ? r2((part / whole) * 100) : null);

  const sector = sectorOf(draft.symbol, settings);
  const inSector = (s: string) => sectorOf(s, settings) === sector;
  const sectorBefore = sector
    ? book.holdings.filter((h) => inSector(h.symbol)).reduce((a, h) => r2(a + (h.marketValue ?? 0)), 0)
    : 0;
  const sectorAfter = sector ? r2(sectorBefore - symBefore + symAfter) : 0;

  return {
    symbol: draft.symbol,
    side: draft.side,
    qty,
    price,
    gross,
    commission,
    levies,
    netAmount,
    cashAfter,
    shortfall,
    costRelieved,
    gain,
    cgtEstimate,
    qtyBefore,
    qtyAfter,
    oversold,
    weightBefore: pct(symBefore, mvBefore),
    weightAfter: pct(symAfter, mvAfter),
    sector,
    sectorWeightBefore: sector ? pct(sectorBefore, mvBefore) : null,
    sectorWeightAfter: sector ? pct(sectorAfter, mvAfter) : null,
    tariff,
    warnings,
  };
}

/** The largest whole quantity the available cash can buy, after costs. */
export function maxAffordableQty(price: number, cash: number, tariff: TariffRates): number {
  if (price <= 0 || cash <= 0) return 0;
  const perUnit = price * (1 + (tariff.commissionPct + tariff.leviesPct) / 100);
  return Math.floor(cash / perUnit);
}

/** The cash book row a filled plan becomes, so nothing is typed twice. */
export function planToTxn(plan: PlanCosting, tradeDate: string, seq: number): Omit<Txn, 'id'> {
  return {
    trade_date: tradeDate,
    type: plan.side,
    symbol: plan.symbol,
    qty: plan.qty,
    price: plan.price,
    commission: plan.commission,
    amount: plan.netAmount,
    gross: null,
    stmt_balance: null,
    external: false,
    voucher: null,
    note: 'Raised from a filled trade plan. Check against the broker contract note.',
    source: 'trade planner',
    seq,
  };
}
