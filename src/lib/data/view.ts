import 'server-only';
import { cache } from 'react';
import { getRepo, type Mode } from './repo';
import { buildBook, latestPrices, type Book } from '../engine/holdings';
import { buildStatements, type Statements } from '../engine/ifrs';
import { buildLedger, cashBalance, cashProof, fundsIntroduced, type CashProof, type LedgerRow } from '../engine/ledger';
import { cgtSummary, incomeSummary, type CgtSummary, type IncomeSummary } from '../engine/reports';
import type { BookData } from '../types';
import { r2 } from '../money';

export interface View {
  mode: Mode;
  data: BookData;
  book: Book;
  ledger: LedgerRow[];
  proof: CashProof;
  cgt: CgtSummary;
  income: IncomeSummary;
  statements: Statements;
  cash: number;
  fundsIntroduced: number;
  /** Cash plus holdings at market. */
  equity: number;
  /** Equity less funds introduced, plus income banked outside the broker. */
  gainOnFunds: number;
  pricedAt: string | null;
  /** The date the book is reported at. */
  reportingDate: string;
  fxRate: number;
  fxAsOf: string | null;
  symbols: string[];
}

/**
 * Loads the book and derives everything from it once per request. Pages read
 * this rather than recomputing, so every screen shows the same figures.
 */
export const loadView = cache(async (): Promise<View> => {
  const repo = await getRepo();
  const data = await repo.load();
  const { transactions, prices, settings } = data;

  const book = buildBook(transactions, prices, settings);
  const cgt = cgtSummary(transactions, book.disposals);
  const income = incomeSummary(transactions, book, cgt);
  const statements = buildStatements(transactions, book, cgt, settings);
  const cash = cashBalance(transactions);
  const funds = fundsIntroduced(transactions);
  const equity = r2(cash + book.marketValueTotal);
  const externalIncome = transactions.filter((t) => t.external).reduce((a, t) => r2(a + t.amount), 0);

  const marks = latestPrices(prices, settings);
  const dates = Object.values(marks).map((m) => m.asOf).filter(Boolean).sort();

  const symbols = [...new Set([
    ...transactions.map((t) => t.symbol).filter((s): s is string => Boolean(s)),
    ...Object.keys(marks),
  ])].sort();

  return {
    mode: repo.mode,
    data,
    book,
    ledger: buildLedger(transactions),
    proof: cashProof(transactions, settings),
    cgt,
    income,
    statements,
    cash,
    fundsIntroduced: funds,
    equity,
    gainOnFunds: r2(equity + externalIncome - funds),
    pricedAt: dates.length ? dates[dates.length - 1] : null,
    reportingDate: statements.periodEnd,
    fxRate: settings.fx?.rate ?? 0,
    fxAsOf: settings.fx?.asOf ?? null,
    symbols,
  };
});
