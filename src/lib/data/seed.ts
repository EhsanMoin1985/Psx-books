import type { BookData, Price, Settings, Txn, TxnType } from '../types';
import raw from '../../../psx-books-data.json';

/** Shape of a row in the seed file, which predates the database column names. */
interface RawTxn {
  id: string;
  date: string;
  type: string;
  amount: number;
  seq: number;
  voucher?: string;
  note?: string;
  source?: string;
  symbol?: string;
  qty?: number;
  price?: number;
  comm?: number;
  stmtBalance?: number;
  external?: boolean;
  gross?: number;
  tax?: number;
}

export function mapSeedTxn(t: RawTxn): Txn {
  return {
    id: t.id,
    trade_date: t.date,
    type: t.type as TxnType,
    symbol: t.symbol ?? null,
    qty: t.qty ?? null,
    price: t.price ?? null,
    commission: t.comm ?? null,
    amount: t.amount,
    gross: t.gross ?? null,
    stmt_balance: t.stmtBalance ?? null,
    external: t.external ?? false,
    voucher: t.voucher ?? null,
    note: t.note ?? null,
    source: t.source ?? null,
    seq: t.seq,
  };
}

export function seedTransactions(): Txn[] {
  return (raw.transactions as RawTxn[]).map(mapSeedTxn);
}

export function seedSettings(): Settings {
  return raw.settings as Settings;
}

/**
 * The settings document holds the latest marks rather than a price history, so
 * the seed starts `prices` with one row per symbol from that snapshot.
 */
export function seedPrices(): Price[] {
  const s = seedSettings();
  const px = s.prices?.px ?? {};
  const asOf = s.prices?.asOf ?? {};
  return Object.entries(px).map(([symbol, close]) => ({
    symbol,
    as_of: asOf[symbol] ?? (s.prices?.updated ?? '').slice(0, 10),
    close,
    last_trade: null,
    source: s.prices?.source ?? 'seed',
  }));
}

export function seedBook(): BookData {
  return {
    transactions: seedTransactions(),
    prices: seedPrices(),
    settings: seedSettings(),
    watchlist: [],
    alerts: [],
    plans: [],
  };
}
