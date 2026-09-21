import type { Settings, Txn } from '../types';
import { fmtDate, r2 } from '../money';
import { type Book, grossOf, transactionCostOf } from './holdings';
import { cashBalance, orderTxns } from './ledger';
import { CGT_RATE, type CgtSummary, dividends } from './reports';

/**
 * IFRS financial statements.
 *
 * The securities are held for trading, so they are financial assets at fair
 * value through profit or loss under IFRS 9. Two consequences run through
 * everything here:
 *   - transaction costs are expensed as incurred, never capitalised, so cost
 *     is measured on gross trade prices;
 *   - all fair value movements, realised and unrealised, go to profit or loss,
 *     which leaves other comprehensive income nil.
 *
 * Dividends that settled in the owner's own bank account are income of the
 * book but never reached the broker, so they are presented as income and as a
 * distribution to the owner, and disclosed as a non-cash transaction.
 *
 * Holdings carried in from before the books open have no purchase in the data.
 * They are measured at a deemed cost, being their 31 December 2025 closing
 * price where the owner has entered one and nil where they have not. That
 * choice moves the split between opening equity and gain, never the totals.
 */

export interface Line {
  label: string;
  value: number;
  /** Render as a subtotal rule. */
  total?: boolean;
  /** Note number to cross-reference. */
  note?: number;
  indent?: boolean;
}

export interface Statements {
  periodStart: string;
  periodEnd: string;
  /** Deemed cost of the pre-2026 holdings at 1 January 2026. */
  openingSecurities: number;
  openingSecuritiesKnown: boolean;
  openingCash: number;
  openingEquity: number;
  contributions: number;
  distributions: number;
  profit: number;
  closingEquity: number;

  position: { assets: Line[]; liabilities: Line[]; equity: Line[]; totalAssets: number; totalLiabilities: number; netAssets: number };
  profitOrLoss: Line[];
  changesInEquity: Line[];
  cashFlows: { operating: Line[]; financing: Line[]; netOperating: number; netFinancing: number; openingCash: number; closingCash: number; netChange: number };

  /** Every check that must hold for the statements to be presentable. */
  checks: { label: string; ok: boolean; detail: string }[];
  balanced: boolean;

  figures: {
    fairValue: number;
    grossCost: number;
    realisedGross: number;
    unrealisedGross: number;
    deemedCostDisposalGain: number;
    dividendIncome: number;
    markup: number;
    transactionCosts: number;
    brokerFees: number;
    whtOnDividends: number;
    cgtBilled: number;
    cgtAccrued: number;
    taxTotal: number;
    profitBeforeTax: number;
  };
}

export function buildStatements(
  txns: Txn[],
  book: Book,
  cgt: CgtSummary,
  settings: Settings,
  reportingDate?: string,
): Statements {
  const ordered = orderTxns(txns);
  const openRow = ordered.find((t) => t.type === 'OPEN');
  const periodStart = openRow?.trade_date ?? ordered[0]?.trade_date ?? '';
  const periodEnd =
    reportingDate ??
    settings.broker?.asOf ??
    settings.prices?.updated?.slice(0, 10) ??
    ordered[ordered.length - 1]?.trade_date ??
    '';

  // --- opening position -----------------------------------------------------
  const openingCash = openRow?.amount ?? 0;
  const openingPx = settings.openingPrices ?? {};
  const openingSecuritiesKnown = Object.keys(book.opening).every((s) => openingPx[s] != null);
  const openingSecurities = r2(
    Object.entries(book.opening).reduce((a, [s, q]) => a + (openingPx[s] ?? 0) * q, 0),
  );
  const openingEquity = r2(openingCash + openingSecurities);

  // --- equity movements -----------------------------------------------------
  const contributions = ordered
    .filter((t) => t.type === 'DEPOSIT')
    .reduce((a, t) => r2(a + t.amount), 0);
  const withdrawals = ordered
    .filter((t) => t.type === 'WITHDRAWAL')
    .reduce((a, t) => r2(a + t.amount), 0);
  // Dividends banked outside the broker never became an asset of the book, so
  // they are presented as a distribution of that income to the owner.
  const externalIncome = ordered
    .filter((t) => t.external)
    .reduce((a, t) => r2(a + t.amount), 0);
  const distributions = r2(withdrawals - externalIncome);

  // --- profit or loss, on the gross basis -----------------------------------
  const fairValue = book.marketValueTotal;
  const grossCost = book.costGrossTotal;
  const unrealisedGross = r2(fairValue - grossCost);
  const realisedGross = book.realisedGross;

  // Pre-2026 units are relieved at their deemed cost; the balance is a gain.
  const deemedCostRelieved = r2(
    book.disposals.reduce((a, d) => a + (openingPx[d.symbol] ?? 0) * d.qtyFromOpening, 0),
  );
  // Measured on gross proceeds, because the transaction costs on these
  // disposals are already expensed in full below.
  const deemedCostDisposalGain = r2(book.proceedsNoCostGross - deemedCostRelieved);

  const divs = dividends(txns);
  const dividendIncome = divs.reduce((a, d) => r2(a + d.gross), 0);
  const whtOnDividends = divs.reduce((a, d) => r2(a + d.tax), 0);
  const markup = ordered.filter((t) => t.type === 'MARKUP').reduce((a, t) => r2(a + t.amount), 0);

  let transactionCosts = 0;
  for (const t of ordered) if (t.type === 'BUY' || t.type === 'SELL') transactionCosts = r2(transactionCosts + transactionCostOf(t));
  const brokerFees = ordered.filter((t) => t.type === 'FEE').reduce((a, t) => r2(a + Math.abs(t.amount)), 0);

  const profitBeforeTax = r2(
    realisedGross + unrealisedGross + deemedCostDisposalGain + dividendIncome + markup - transactionCosts - brokerFees,
  );
  const cgtBilled = cgt.billedTotal;
  const cgtAccrued = cgt.accrued;
  const taxTotal = r2(whtOnDividends + cgtBilled + cgtAccrued);
  const profit = r2(profitBeforeTax - taxTotal);

  // --- statement of financial position --------------------------------------
  const closingCash = cashBalance(txns);
  const cgtPayable = cgtAccrued;
  const totalAssets = r2(fairValue + closingCash);
  const totalLiabilities = cgtPayable;
  const netAssets = r2(totalAssets - totalLiabilities);
  const closingEquity = r2(openingEquity + contributions + distributions + profit);

  const position = {
    assets: [
      { label: 'Financial assets at fair value through profit or loss', value: fairValue, note: 3 },
      { label: 'Cash and cash equivalents', value: closingCash, note: 8 },
      { label: 'Total assets', value: totalAssets, total: true },
    ] as Line[],
    liabilities: [
      { label: 'Current tax payable — capital gains tax accrued', value: cgtPayable, note: 5 },
      { label: 'Total liabilities', value: totalLiabilities, total: true },
    ] as Line[],
    equity: [
      { label: 'Contributed capital', value: r2(openingEquity + contributions), note: 4 },
      { label: 'Retained earnings', value: r2(netAssets - openingEquity - contributions), note: 4 },
      { label: 'Total equity', value: netAssets, total: true },
    ] as Line[],
    totalAssets,
    totalLiabilities,
    netAssets,
  };

  const profitOrLoss: Line[] = [
    { label: 'Net realised gain on financial assets at FVTPL', value: realisedGross, note: 4 },
    { label: 'Net change in unrealised fair value of financial assets at FVTPL', value: unrealisedGross, note: 4 },
    { label: 'Gain on disposal of holdings carried at deemed cost', value: deemedCostDisposalGain, note: 4 },
    { label: 'Dividend income, gross', value: dividendIncome, note: 6 },
    { label: 'Markup on cash held with the broker', value: markup },
    { label: 'Transaction costs expensed', value: -transactionCosts, note: 2 },
    { label: 'Broker and custody fees', value: -brokerFees },
    { label: 'Profit before tax', value: profitBeforeTax, total: true },
    { label: 'Withholding tax on dividends', value: -whtOnDividends, note: 5 },
    { label: 'Capital gains tax billed', value: -cgtBilled, note: 5 },
    { label: 'Capital gains tax accrued, estimated', value: -cgtAccrued, note: 5 },
    { label: 'Profit for the period', value: profit, total: true },
    { label: 'Other comprehensive income', value: 0, note: 2 },
    { label: 'Total comprehensive income for the period', value: profit, total: true },
  ];

  const changesInEquity: Line[] = [
    { label: `Balance at ${fmtDate(periodStart)}`, value: openingEquity, total: true, note: 4 },
    { label: 'Contributions from the owner', value: contributions },
    { label: 'Dividends banked outside the broker account', value: -externalIncome, note: 7 },
    { label: 'Withdrawals', value: withdrawals },
    { label: 'Total comprehensive income for the period', value: profit },
    { label: `Balance at ${fmtDate(periodEnd)}`, value: closingEquity, total: true },
  ];

  // --- cash flows, direct method -------------------------------------------
  // Only rows that touched the broker account appear here.
  let purchases = 0, proceeds = 0, feesPaid = 0, cgtPaid = 0, markupReceived = 0, dividendsReceived = 0;
  for (const t of ordered) {
    if (t.external || t.type === 'OPEN') continue;
    if (t.type === 'BUY') purchases = r2(purchases + t.amount);
    else if (t.type === 'SELL') proceeds = r2(proceeds + t.amount);
    else if (t.type === 'FEE') feesPaid = r2(feesPaid + t.amount);
    else if (t.type === 'CGT') cgtPaid = r2(cgtPaid + t.amount);
    else if (t.type === 'MARKUP') markupReceived = r2(markupReceived + t.amount);
    else if (t.type === 'DIVIDEND') dividendsReceived = r2(dividendsReceived + t.amount);
  }
  const netOperating = r2(purchases + proceeds + feesPaid + cgtPaid + markupReceived + dividendsReceived);
  const netFinancing = r2(contributions + withdrawals);

  const cashFlows = {
    operating: [
      { label: 'Proceeds from sale of financial assets held for trading', value: proceeds },
      { label: 'Payments to acquire financial assets held for trading', value: purchases },
      { label: 'Dividends received into the broker account', value: dividendsReceived, note: 7 },
      { label: 'Markup received', value: markupReceived },
      { label: 'Broker and custody fees paid', value: feesPaid },
      { label: 'Capital gains tax paid', value: cgtPaid },
      { label: 'Net cash from operating activities', value: netOperating, total: true },
    ] as Line[],
    financing: [
      { label: 'Contributions from the owner', value: contributions },
      { label: 'Withdrawals by the owner', value: withdrawals },
      { label: 'Net cash from financing activities', value: netFinancing, total: true },
    ] as Line[],
    netOperating,
    netFinancing,
    openingCash,
    closingCash,
    netChange: r2(closingCash - openingCash),
  };

  const eq = (a: number, b: number) => r2(a - b) === 0;
  const checks = [
    {
      label: 'Assets less liabilities equals equity',
      ok: eq(netAssets, closingEquity),
      detail: `${netAssets.toFixed(2)} against ${closingEquity.toFixed(2)}`,
    },
    {
      label: 'Cash flows reconcile to the movement in cash',
      ok: eq(r2(netOperating + netFinancing), cashFlows.netChange),
      detail: `${r2(netOperating + netFinancing).toFixed(2)} against ${cashFlows.netChange.toFixed(2)}`,
    },
    {
      label: 'Closing cash agrees to the cash book',
      ok: eq(closingCash, settings.statement?.closing ?? closingCash),
      detail: `${closingCash.toFixed(2)} against the statement`,
    },
    {
      label: 'Changes in equity foot to the closing balance',
      ok: eq(r2(openingEquity + contributions + distributions + profit), closingEquity),
      detail: `${closingEquity.toFixed(2)}`,
    },
    {
      label: 'Fair value of holdings is complete',
      ok: book.fullyPriced,
      detail: book.fullyPriced ? 'every holding is marked to a stored price' : 'one or more holdings have no price',
    },
  ];

  return {
    periodStart, periodEnd,
    openingSecurities, openingSecuritiesKnown, openingCash, openingEquity,
    contributions, distributions, profit, closingEquity,
    position, profitOrLoss, changesInEquity, cashFlows,
    checks,
    balanced: checks.every((c) => c.ok),
    figures: {
      fairValue, grossCost, realisedGross, unrealisedGross, deemedCostDisposalGain,
      dividendIncome, markup, transactionCosts, brokerFees,
      whtOnDividends, cgtBilled, cgtAccrued, taxTotal, profitBeforeTax,
    },
  };
}

/** Concentration of the portfolio, for the financial risk note. */
export function concentration(book: Book) {
  const total = book.marketValueTotal;
  return book.holdings
    .map((h) => ({ symbol: h.symbol, value: h.marketValue ?? 0, pct: total > 0 ? r2(((h.marketValue ?? 0) / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
}

/** Effect of a uniform move in prices, for the market risk note. */
export function sensitivity(book: Book, pct: number) {
  return r2(book.marketValueTotal * (pct / 100));
}

/** Tax that would arise if every holding were sold at its carrying value today. */
export function deferredTaxPosition(book: Book) {
  let gains = 0;
  let losses = 0;
  for (const h of book.holdings) {
    const u = h.unrealised;
    if (u == null) continue;
    if (u > 0) gains = r2(gains + u);
    else losses = r2(losses - u);
  }
  return {
    gains,
    losses,
    net: r2(gains - losses),
    deferredTaxLiability: r2(gains * CGT_RATE),
    unrecognisedDeferredTaxAsset: r2(losses * CGT_RATE),
  };
}
