import { describe, expect, it } from 'vitest';
import { seedBook } from '@/lib/data/seed';
import { buildBook } from '@/lib/engine/holdings';
import { cashBalance } from '@/lib/engine/ledger';
import { costPlan, deriveTariff, maxAffordableQty, planToTxn } from '@/lib/engine/planner';
import { parsePasted, ManualPriceSource, pktDate, isTradingDay } from '@/lib/prices/source';
import { r2 } from '@/lib/money';

const { transactions: tx, prices, settings } = seedBook();
const book = buildBook(tx, prices, settings);
const cash = cashBalance(tx);

describe('the trade planner', () => {
  it('derives the broker tariff from the trades actually done', () => {
    const t = deriveTariff(tx);
    expect(t.sample).toBeGreaterThan(30);
    expect(t.commissionPct).toBeCloseTo(0.15, 2);
    expect(t.leviesPct).toBeCloseTo(0.0345, 3);
  });

  it('costs a buy and flags one the cash cannot cover', () => {
    const ok = costPlan({ symbol: 'UBL', side: 'BUY', qty: 100, limitPrice: 430 }, book, cash, tx, settings);
    expect(ok.gross).toBe(43000);
    expect(ok.netAmount).toBe(r2(-(43000 + ok.commission + ok.levies)));
    expect(ok.shortfall).toBe(0);
    expect(ok.warnings).toEqual([]);

    const tooBig = costPlan({ symbol: 'UBL', side: 'BUY', qty: 10000, limitPrice: 430 }, book, cash, tx, settings);
    expect(tooBig.shortfall).toBeGreaterThan(0);
    expect(tooBig.warnings.join(' ')).toContain('more than the cash available');
  });

  it('estimates the gain and the tax on a sale', () => {
    const p = costPlan({ symbol: 'PSX', side: 'SELL', qty: 2500, limitPrice: 60 }, book, cash, tx, settings);
    expect(p.costRelieved).toBeGreaterThan(0);
    expect(p.gain).toBeGreaterThan(0);
    expect(p.cgtEstimate).toBe(r2(p.gain! * 0.15));
    expect(p.qtyAfter).toBe(10000);
  });

  it('books no tax on a sale at a loss and refuses to oversell', () => {
    const loss = costPlan({ symbol: 'UBL', side: 'SELL', qty: 100, limitPrice: 300 }, book, cash, tx, settings);
    expect(loss.gain).toBeLessThan(0);
    expect(loss.cgtEstimate).toBe(0);

    const over = costPlan({ symbol: 'UBL', side: 'SELL', qty: 99999, limitPrice: 430 }, book, cash, tx, settings);
    expect(over.oversold).toBe(true);
  });

  it('shows what the order does to symbol and sector weight', () => {
    const p = costPlan({ symbol: 'UBL', side: 'BUY', qty: 100, limitPrice: 430 }, book, cash, tx, settings);
    expect(p.sector).toBe('Commercial banks');
    expect(p.weightAfter!).toBeGreaterThan(p.weightBefore!);
    expect(p.sectorWeightAfter!).toBeGreaterThan(p.sectorWeightBefore!);
  });

  it('sizes a position to the cash available', () => {
    const t = deriveTariff(tx);
    const n = maxAffordableQty(430, cash, t);
    const spend = costPlan({ symbol: 'UBL', side: 'BUY', qty: n, limitPrice: 430 }, book, cash, tx, settings);
    expect(spend.shortfall).toBe(0);
    const oneMore = costPlan({ symbol: 'UBL', side: 'BUY', qty: n + 1, limitPrice: 430 }, book, cash, tx, settings);
    expect(oneMore.shortfall).toBeGreaterThan(0);
  });

  it('turns a filled plan into a cash book row', () => {
    const p = costPlan({ symbol: 'UBL', side: 'BUY', qty: 100, limitPrice: 430 }, book, cash, tx, settings);
    const row = planToTxn(p, '2026-09-21', 999);
    expect(row.type).toBe('BUY');
    expect(row.amount).toBe(p.netAmount);
    expect(row.external).toBe(false);
    expect(row.stmt_balance).toBeNull();
  });
});

describe('the price source', () => {
  it('reads pasted figures in several shapes and skips what it cannot read', () => {
    const { quotes, skipped } = parsePasted('UBL,430.80\nATRL\t1096\nPSX 45.50 2026-09-18\nnonsense\n', '2026-09-19');
    expect(quotes).toEqual([
      { symbol: 'UBL', close: 430.8, asOf: '2026-09-19' },
      { symbol: 'ATRL', close: 1096, asOf: '2026-09-19' },
      { symbol: 'PSX', close: 45.5, asOf: '2026-09-18' },
    ]);
    expect(skipped).toEqual(['nonsense']);
  });

  it('says why it cannot run rather than inventing a price', async () => {
    expect(new ManualPriceSource('').unavailable()).toMatch(/pasted/);
    const src = new ManualPriceSource('UBL,430.80\nXYZ,1.00');
    expect(src.unavailable()).toBeNull();
    expect(await src.fetch(['UBL'], '2026-09-21')).toEqual([{ symbol: 'UBL', close: 430.8, asOf: '2026-09-21' }]);
  });

  it('works in the Pakistan trading day, not the server one', () => {
    expect(pktDate(new Date('2026-09-20T20:00:00Z'))).toBe('2026-09-21');
    expect(isTradingDay('2026-09-21')).toBe(true);
    expect(isTradingDay('2026-09-19')).toBe(false);
  });
});
