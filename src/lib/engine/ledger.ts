import type { Settings, Txn } from '../types';
import { r2 } from '../money';

/**
 * The cash book. Rows that settled outside the broker (`external`) are excluded
 * from the running balance and from the control totals, because the broker
 * statement never saw them.
 */

export interface LedgerRow extends Txn {
  /** Balance recomputed from the opening row forward. Null on external rows. */
  running: number | null;
  /** running - stmt_balance, where the broker gave a balance. */
  drift: number | null;
  /** True when the broker gave a balance and it agrees to the cent. */
  proved: boolean;
}

export function orderTxns(txns: Txn[]): Txn[] {
  return txns
    .slice()
    .sort((a, b) => (a.trade_date === b.trade_date ? a.seq - b.seq : a.trade_date < b.trade_date ? -1 : 1));
}

export function buildLedger(txns: Txn[]): LedgerRow[] {
  let running = 0;
  return orderTxns(txns).map((t) => {
    if (t.external) {
      return { ...t, running: null, drift: null, proved: false };
    }
    running = r2(running + t.amount);
    const drift = t.stmt_balance == null ? null : r2(running - t.stmt_balance);
    return { ...t, running, drift, proved: drift === 0 };
  });
}

export interface CashProof {
  /** Sum of debits (negatives, shown positive). */
  debits: number;
  credits: number;
  closing: number;
  /** Rows where the broker gave a balance. */
  checked: number;
  /** Rows where the recomputed balance disagreed. */
  mismatches: LedgerRow[];
  /** Expected totals from settings, if recorded. */
  expected: { debits?: number; credits?: number; closing?: number };
  /** True when every checked row proves and every recorded control total agrees. */
  reconciled: boolean;
}

export function cashProof(txns: Txn[], settings: Settings): CashProof {
  const rows = buildLedger(txns);
  let debits = 0;
  let credits = 0;
  for (const t of rows) {
    if (t.external) continue;
    if (t.amount < 0) debits = r2(debits - t.amount);
    else credits = r2(credits + t.amount);
  }
  const closing = r2(credits - debits);
  const checked = rows.filter((r) => !r.external && r.stmt_balance != null);
  const mismatches = checked.filter((r) => !r.proved);
  const expected = settings.statement ?? {};
  const agrees = (a: number, b?: number) => b == null || r2(a - b) === 0;

  return {
    debits,
    credits,
    closing,
    checked: checked.length,
    mismatches,
    expected: { debits: expected.debits, credits: expected.credits, closing: expected.closing },
    reconciled:
      mismatches.length === 0 &&
      agrees(debits, expected.debits) &&
      agrees(credits, expected.credits) &&
      agrees(closing, expected.closing),
  };
}

/** Broker cash at a date (or at the end). External rows never touch broker cash. */
export function cashBalance(txns: Txn[], asOf?: string): number {
  let bal = 0;
  for (const t of orderTxns(txns)) {
    if (t.external) continue;
    if (asOf && t.trade_date > asOf) break;
    bal = r2(bal + t.amount);
  }
  return bal;
}

/** Cash introduced by the owner: the opening balance plus deposits, less withdrawals. */
export function fundsIntroduced(txns: Txn[]): number {
  let v = 0;
  for (const t of txns) {
    if (t.type === 'OPEN' || t.type === 'DEPOSIT') v = r2(v + t.amount);
    if (t.type === 'WITHDRAWAL') v = r2(v + t.amount);
  }
  return v;
}
