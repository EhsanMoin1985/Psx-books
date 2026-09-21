import { describe, expect, it } from 'vitest';
import { seedBook } from '@/lib/data/seed';
import { buildBook } from '@/lib/engine/holdings';
import { cgtSummary } from '@/lib/engine/reports';
import { buildStatements, deferredTaxPosition } from '@/lib/engine/ifrs';
import { r2 } from '@/lib/money';

const { transactions: tx, prices, settings } = seedBook();
const book = buildBook(tx, prices, settings);
const cgt = cgtSummary(tx, book.disposals);

describe('the financial statements balance', () => {
  const st = buildStatements(tx, book, cgt, settings);

  it('passes every presentation check', () => {
    expect(st.checks.filter((c) => !c.ok)).toEqual([]);
    expect(st.balanced).toBe(true);
  });

  it('puts assets less liabilities equal to equity', () => {
    expect(r2(st.position.totalAssets - st.position.totalLiabilities)).toBe(st.position.netAssets);
    expect(st.position.netAssets).toBe(st.closingEquity);
  });

  it('foots the cash flow statement to the movement in broker cash', () => {
    const { netOperating, netFinancing, openingCash, closingCash } = st.cashFlows;
    expect(r2(netOperating + netFinancing)).toBe(r2(closingCash - openingCash));
    expect(closingCash).toBe(401044.16);
  });

  it('keeps dividends banked outside the broker out of the cash flow statement', () => {
    const line = st.cashFlows.operating.find((l) => l.label.includes('Dividends received'))!;
    expect(line.value).toBe(0);
    // but they are still income, and leave the book as a distribution
    expect(st.figures.dividendIncome).toBe(20000);
    expect(st.distributions).toBe(-17000);
  });

  it('expenses transaction costs rather than capitalising them', () => {
    // Gross cost plus the transaction costs still held must equal the books cost.
    const heldTc = r2(book.costTotal - book.costGrossTotal);
    expect(heldTc).toBeGreaterThan(0);
    expect(st.figures.transactionCosts).toBe(14523.56);
    const line = st.profitOrLoss.find((l) => l.label.startsWith('Transaction costs'))!;
    expect(line.value).toBe(-14523.56);
  });

  it('leaves other comprehensive income nil under FVTPL', () => {
    expect(st.profitOrLoss.find((l) => l.label === 'Other comprehensive income')!.value).toBe(0);
    const tci = st.profitOrLoss.find((l) => l.label.startsWith('Total comprehensive'))!;
    expect(tci.value).toBe(st.profit);
  });

  it('still balances once 31 Dec 2025 prices are entered for the pre-2026 holdings', () => {
    const withOpening = { ...settings, openingPrices: { NBP: 240, KEL: 7.1, SEARL: 80 } };
    const b2 = buildBook(tx, prices, withOpening);
    const st2 = buildStatements(tx, b2, cgtSummary(tx, b2.disposals), withOpening);
    expect(st2.balanced).toBe(true);
    expect(st2.openingSecuritiesKnown).toBe(true);
    expect(st2.openingSecurities).toBe(r2(10 * 240 + 1000 * 7.1 + 113 * 80));
    // Opening equity rises by the deemed cost; the disposal gain falls by it.
    expect(r2(st.openingEquity - st2.openingEquity)).toBe(-st2.openingSecurities);
    expect(r2(st.figures.deemedCostDisposalGain - st2.figures.deemedCostDisposalGain)).toBe(st2.openingSecurities);
    // and the closing net assets are unmoved, because nothing real changed
    expect(st2.position.netAssets).toBe(st.position.netAssets);
  });

  it('separates the deferred tax asset that is not recognised', () => {
    const d = deferredTaxPosition(book);
    expect(r2(d.gains - d.losses)).toBe(d.net);
    expect(d.unrecognisedDeferredTaxAsset).toBeGreaterThan(0);
  });
});
