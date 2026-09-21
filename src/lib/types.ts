/** Domain types for PSX Books. Money is always PKR unless a type says otherwise. */

export const TXN_TYPES = [
  'OPEN',
  'BUY',
  'SELL',
  'DEPOSIT',
  'WITHDRAWAL',
  'DIVIDEND',
  'MARKUP',
  'CGT',
  'FEE',
] as const;

export type TxnType = (typeof TXN_TYPES)[number];

/** A row of the cash book, mirroring the `transactions` table. */
export interface Txn {
  id: string;
  trade_date: string; // ISO date, yyyy-mm-dd
  type: TxnType;
  symbol: string | null;
  qty: number | null;
  price: number | null;
  /** Broker commission, already included in `amount`. */
  commission: number | null;
  /** Signed net amount exactly as the broker statement shows it. Debits negative. */
  amount: number;
  /** Dividends: the amount before withholding tax. */
  gross: number | null;
  /** Broker running balance, for line-by-line proof. Null where the broker shows none. */
  stmt_balance: number | null;
  /** True when the cash settled outside the broker account (dividend paid to the bank). */
  external: boolean;
  voucher: string | null;
  note: string | null;
  source: string | null;
  /** Statement ordering. Two rows on one date are ordered by this, not by id. */
  seq: number;
}

export interface Price {
  symbol: string;
  as_of: string;
  close: number;
  last_trade: number | null;
  source: string | null;
}

export interface WatchRow {
  symbol: string;
  target_buy: number | null;
  target_sell: number | null;
  note: string | null;
}

export interface Alert {
  id: string;
  symbol: string;
  direction: 'above' | 'below';
  level: number;
  active: boolean;
  fired_at: string | null;
}

export type PlanStatus = 'draft' | 'placed' | 'filled' | 'cancelled';

export interface Plan {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  limit_price: number | null;
  rationale: string | null;
  status: PlanStatus;
  created_at: string;
  linked_txn: string | null;
}

/** The single JSONB settings document. */
export interface Settings {
  prices?: {
    px?: Record<string, number>;
    asOf?: Record<string, string>;
    source?: string;
    updated?: string;
  };
  /** Holdings as the broker reports them, for reconciliation. */
  broker?: {
    qty?: Record<string, number>;
    cost?: Record<string, number>;
    asOf?: string;
    source?: string;
  };
  /** Statement control totals, for the cash proof. */
  statement?: {
    debits?: number;
    credits?: number;
    closing?: number;
    ledgerApp?: number;
    period?: string;
    source?: string;
  };
  fx?: { rate?: number; asOf?: string; source?: string };
  /** Closing prices at 31 Dec 2025 for holdings carried in from before the books start. */
  openingPrices?: Record<string, number>;
  /** Dashboard panel order and visibility, keyed by layout name. */
  layouts?: Record<string, string[]>;
  activeLayout?: string;
  sectors?: Record<string, string>;
}

export interface BookData {
  transactions: Txn[];
  prices: Price[];
  settings: Settings;
  watchlist: WatchRow[];
  alerts: Alert[];
  plans: Plan[];
}
