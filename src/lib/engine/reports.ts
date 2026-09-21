import type { Txn } from '../types';
import { r2 } from '../money';
import type { Book, Disposal } from './holdings';
import { transactionCostOf } from './holdings';
import { orderTxns } from './ledger';

/** Capital gains tax is charged at the filer rate. */
export const CGT_RATE = 0.15;
/** Withholding tax on dividends, filer rate. */
export const DIVIDEND_WHT_RATE = 0.15;

export const monthKey = (iso: string) => iso.slice(0, 7);

export interface SymbolGains {
  symbol: string;
  qty: number;
  proceeds: number;
  cost: number;
  gain: number;
  gainPct: number | null;
  /** Proceeds of pre-2026 units, on which no gain is booked. */
  proceedsNoCost: number;
  trades: number;
}

export function realisedBySymbol(disposals: Disposal[]): SymbolGains[] {
  const by = new Map<string, SymbolGains>();
  for (const d of disposals) {
    const g = by.get(d.symbol) ?? {
      symbol: d.symbol, qty: 0, proceeds: 0, cost: 0, gain: 0, gainPct: null, proceedsNoCost: 0, trades: 0,
    };
    g.qty = r2(g.qty + d.qtyCosted);
    g.proceeds = r2(g.proceeds + d.proceedsNet);
    g.cost = r2(g.cost + d.costRelieved);
    g.gain = r2(g.gain + d.gainNet);
    g.proceedsNoCost = r2(g.proceedsNoCost + d.proceedsOpening);
    g.trades += 1;
    by.set(d.symbol, g);
  }
  return [...by.values()]
    .map((g) => ({ ...g, gainPct: g.cost > 0 ? r2((g.gain / g.cost) * 100) : null }))
    .sort((a, b) => b.gain - a.gain);
}

export interface MonthGains {
  month: string;
  proceeds: number;
  cost: number;
  gain: number;
  trades: number;
}

export function realisedByMonth(disposals: Disposal[]): MonthGains[] {
  const by = new Map<string, MonthGains>();
  for (const d of disposals) {
    const k = monthKey(d.date);
    const m = by.get(k) ?? { month: k, proceeds: 0, cost: 0, gain: 0, trades: 0 };
    m.proceeds = r2(m.proceeds + d.proceedsNet);
    m.cost = r2(m.cost + d.costRelieved);
    m.gain = r2(m.gain + d.gainNet);
    m.trades += 1;
    by.set(k, m);
  }
  return [...by.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * NCCPL bills capital gains tax monthly in arrears, so a charge in the cash book
 * belongs to an earlier month. The note carries that month ("CGT Jul-2026");
 * where it does not, the month before the charge is assumed.
 */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function cgtPeriodOf(t: Txn): string {
  const m = (t.note ?? '').match(/([A-Za-z]{3})[a-z]*[-\s](\d{4})/);
  if (m) {
    const i = MONTHS.indexOf(m[1].toLowerCase());
    if (i >= 0) return `${m[2]}-${String(i + 1).padStart(2, '0')}`;
  }
  const [y, mo] = t.trade_date.split('-').map(Number);
  const d = new Date(Date.UTC(y, mo - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export interface CgtMonth {
  month: string;
  gain: number;
  /** Tax actually billed by NCCPL for that month, where it has been billed. */
  billed: number | null;
  billedOn: string | null;
  /** Tax at the filer rate on the month's gains. */
  expected: number;
  /** billed / gain. */
  effectiveRate: number | null;
  /**
   * billed  NCCPL has charged the month.
   * accrued falls after the last billed month, so tax is estimated on it.
   * prior   falls on or before the last billed month but was never charged,
   *         NCCPL having netted it against losses elsewhere or fallen below
   *         its collection threshold. No accrual is raised.
   */
  status: 'billed' | 'accrued' | 'prior';
}

export interface CgtSummary {
  months: CgtMonth[];
  /** The last month NCCPL has billed. Gains after it are unbilled. */
  lastBilled: string | null;
  billedTotal: number;
  /** Estimated tax on gains realised since the last billed month. */
  accrued: number;
  accruedGain: number;
  effectiveRateToDate: number | null;
}

export function cgtSummary(txns: Txn[], disposals: Disposal[]): CgtSummary {
  const billed = new Map<string, { amount: number; on: string }>();
  for (const t of txns) {
    if (t.type !== 'CGT') continue;
    const k = cgtPeriodOf(t);
    const prev = billed.get(k);
    billed.set(k, { amount: r2((prev?.amount ?? 0) + Math.abs(t.amount)), on: t.trade_date });
  }
  const gains = new Map(realisedByMonth(disposals).map((m) => [m.month, m.gain]));
  const keys = [...new Set([...gains.keys(), ...billed.keys()])].sort();
  const lastBilled = [...billed.keys()].sort().pop() ?? null;

  const months: CgtMonth[] = keys.map((month) => {
    const gain = gains.get(month) ?? 0;
    const b = billed.get(month) ?? null;
    return {
      month,
      gain,
      billed: b?.amount ?? null,
      billedOn: b?.on ?? null,
      expected: r2(Math.max(gain, 0) * CGT_RATE),
      effectiveRate: b && gain > 0 ? r2((b.amount / gain) * 100) : null,
      status: b ? 'billed' : lastBilled && month <= lastBilled ? 'prior' : 'accrued',
    };
  });

  const unbilled = months.filter((m) => m.status === 'accrued');
  const accruedGain = unbilled.reduce((a, m) => r2(a + m.gain), 0);
  const billedTotal = months.reduce((a, m) => r2(a + (m.billed ?? 0)), 0);
  const gainBilled = months.filter((m) => m.billed != null).reduce((a, m) => r2(a + m.gain), 0);

  return {
    months,
    lastBilled,
    billedTotal,
    accrued: r2(Math.max(accruedGain, 0) * CGT_RATE),
    accruedGain,
    effectiveRateToDate: gainBilled > 0 ? r2((billedTotal / gainBilled) * 100) : null,
  };
}

export interface DividendRow {
  id: string;
  date: string;
  symbol: string | null;
  gross: number;
  tax: number;
  net: number;
  external: boolean;
  note: string | null;
}

export function dividends(txns: Txn[]): DividendRow[] {
  return orderTxns(txns)
    .filter((t) => t.type === 'DIVIDEND')
    .map((t) => {
      const gross = t.gross ?? t.amount;
      return {
        id: t.id,
        date: t.trade_date,
        symbol: t.symbol,
        gross,
        tax: r2(gross - t.amount),
        net: t.amount,
        external: t.external,
        note: t.note,
      };
    });
}

export interface TradingCosts {
  commission: number;
  /** CVT and exchange levies: the gap between gross consideration and the net amount. */
  levies: number;
  /** Broker fees charged separately: CDC custody, UIN and CGT tariff charges. */
  fees: number;
  total: number;
  turnover: number;
  /** Total cost as a percentage of turnover. */
  pctOfTurnover: number | null;
  trades: number;
}

export function tradingCosts(txns: Txn[]): TradingCosts {
  let commission = 0;
  let levies = 0;
  let fees = 0;
  let turnover = 0;
  let trades = 0;
  for (const t of txns) {
    if (t.type === 'FEE') {
      fees = r2(fees + Math.abs(t.amount));
      continue;
    }
    if (t.type !== 'BUY' && t.type !== 'SELL') continue;
    trades += 1;
    const gross = r2((t.qty ?? 0) * (t.price ?? 0));
    turnover = r2(turnover + gross);
    commission = r2(commission + (t.commission ?? 0));
    levies = r2(levies + transactionCostOf(t) - (t.commission ?? 0));
  }
  const total = r2(commission + levies + fees);
  return {
    commission, levies, fees, total, turnover, trades,
    pctOfTurnover: turnover > 0 ? r2((total / turnover) * 100) : null,
  };
}

export interface IncomeSummary {
  dividendGross: number;
  dividendTax: number;
  dividendNet: number;
  markup: number;
  realised: number;
  unrealised: number;
  tradingCosts: number;
  cgtBilled: number;
  cgtAccrued: number;
  /** Total return before tax: realised and unrealised gains plus income. */
  totalReturn: number;
}

export function incomeSummary(txns: Txn[], book: Book, cgt: CgtSummary): IncomeSummary {
  const divs = dividends(txns);
  const dividendGross = divs.reduce((a, d) => r2(a + d.gross), 0);
  const dividendTax = divs.reduce((a, d) => r2(a + d.tax), 0);
  const markup = txns.filter((t) => t.type === 'MARKUP').reduce((a, t) => r2(a + t.amount), 0);
  const costs = tradingCosts(txns);
  return {
    dividendGross,
    dividendTax,
    dividendNet: r2(dividendGross - dividendTax),
    markup,
    realised: book.realisedNet,
    unrealised: book.unrealisedTotal,
    tradingCosts: costs.total,
    cgtBilled: cgt.billedTotal,
    cgtAccrued: cgt.accrued,
    totalReturn: r2(book.realisedNet + book.unrealisedTotal + dividendGross + markup),
  };
}
