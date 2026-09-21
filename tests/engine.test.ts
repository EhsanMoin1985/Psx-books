import { describe, expect, it } from 'vitest';
import { seedBook } from '@/lib/data/seed';
import { buildLedger, cashProof, cashBalance, fundsIntroduced } from '@/lib/engine/ledger';
import { buildBook, inferOpeningQty } from '@/lib/engine/holdings';
import { r2 } from '@/lib/money';

const book = seedBook();
const { transactions, prices, settings } = book;

describe('the cash book proves against the broker statement', () => {
  it('carries 61 rows, two of them settled outside the broker', () => {
    expect(transactions).toHaveLength(61);
    expect(transactions.filter((t) => t.external)).toHaveLength(2);
  });

  it('agrees to stmt_balance on every row the broker gave one for', () => {
    const rows = buildLedger(transactions).filter((r) => !r.external && r.stmt_balance != null);
    expect(rows.length).toBe(59);
    expect(rows.filter((r) => !r.proved)).toEqual([]);
  });

  it('reproduces the statement control totals to the cent', () => {
    const p = cashProof(transactions, settings);
    expect(p.debits).toBe(5596445.37);
    expect(p.credits).toBe(5997489.53);
    expect(p.closing).toBe(401044.16);
    expect(p.reconciled).toBe(true);
  });

  it('leaves external dividends out of broker cash', () => {
    expect(cashBalance(transactions)).toBe(401044.16);
    const external = transactions.filter((t) => t.external).reduce((a, t) => r2(a + t.amount), 0);
    expect(external).toBe(17000);
  });

  it('counts funds introduced as the opening balance plus deposits', () => {
    expect(fundsIntroduced(transactions)).toBe(r2(1191.38 + 3993 + 1400000 + 1272879 + 1010862));
  });
});

describe('holdings on weighted average cost', () => {
  const b = buildBook(transactions, prices, settings);

  it('infers the holdings carried in from before the books open', () => {
    expect(inferOpeningQty(transactions)).toEqual({ NBP: 10, KEL: 1000, SEARL: 113 });
  });

  it('matches the quantity JS reports for every symbol', () => {
    const brokerQty = settings.broker!.qty!;
    for (const h of b.holdings) expect([h.symbol, h.qty]).toEqual([h.symbol, brokerQty[h.symbol]]);
    for (const h of b.closed) expect([h.symbol, brokerQty[h.symbol] ?? 0]).toEqual([h.symbol, 0]);
    expect(b.holdings.map((h) => h.symbol).sort()).toEqual(
      Object.entries(brokerQty).filter(([, q]) => q > 0).map(([s]) => s).sort(),
    );
  });

  it('differs from the JS FIFO cost on ATRL by about Rs 364 and nothing else', () => {
    const atrl = b.holdings.find((h) => h.symbol === 'ATRL')!;
    expect(r2(atrl.cost - settings.broker!.cost!.ATRL)).toBe(363.93);
    // Every other symbol differs only because JS rounds its average rate to 2dp.
    for (const h of b.holdings) {
      if (h.symbol === 'ATRL') continue;
      const js = settings.broker!.cost![h.symbol];
      expect([h.symbol, r2(js - r2(Math.round((h.cost / h.qty) * 100) / 100 * h.qty))]).toEqual([h.symbol, 0]);
    }
  });

  it('books proceeds and no gain on disposals of pre-2026 holdings', () => {
    const noCost = b.disposals.filter((d) => d.qtyFromOpening > 0);
    expect(noCost.map((d) => [d.symbol, d.qtyFromOpening])).toEqual([
      ['NBP', 10], ['KEL', 1000], ['SEARL', 113],
    ]);
    expect(b.proceedsNoCost).toBe(r2(2486.4 + 7564.59 + 9544.42));
    for (const d of noCost) expect(d.gainNet).toBe(d.qtyCosted > 0 ? d.gainNet : 0);
  });

  it('marks the book to the stored prices', () => {
    expect(b.fullyPriced).toBe(true);
    expect(b.marketValueTotal).toBe(
      r2(650 * 1096 + 2000 * 57.3 + 5000 * 39.45 + 1000 * 552.5 + 1000 * 348 + 1000 * 21.33 + 12500 * 45.5 + 1500 * 430.8),
    );
  });

  it('keeps cost, realised gain and proceeds internally consistent', () => {
    // Every rupee that went into a symbol either sits in cost, was relieved on a
    // disposal, or was a pre-2026 unit carrying no cost.
    for (const h of [...b.holdings, ...b.closed]) {
      const bought = transactions
        .filter((t) => t.symbol === h.symbol && t.type === 'BUY')
        .reduce((a, t) => r2(a + Math.abs(t.amount)), 0);
      const relieved = b.disposals
        .filter((d) => d.symbol === h.symbol)
        .reduce((a, d) => r2(a + d.costRelieved), 0);
      expect([h.symbol, r2(bought - relieved - h.cost)]).toEqual([h.symbol, 0]);
    }
  });
});
