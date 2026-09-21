'use server';

import { revalidatePath } from 'next/cache';
import { getRepo } from '@/lib/data/repo';
import { loadView } from '@/lib/data/view';
import { costPlan, planToTxn } from '@/lib/engine/planner';
import { parsePasted, quotesToPrices } from '@/lib/prices/source';
import { pktDate } from '@/lib/prices/source';
import type { Settings, Txn } from '@/lib/types';

function refresh() {
  for (const p of ['/', '/holdings', '/ledger', '/reconcile', '/reports', '/statements', '/planner', '/watchlist', '/settings']) {
    revalidatePath(p);
  }
}

export async function saveLayout(name: string, order: string[]) {
  const repo = await getRepo();
  const view = await loadView();
  const layouts = { ...(view.data.settings.layouts ?? {}), [name]: order };
  await repo.saveSettings({ layouts, activeLayout: name });
  refresh();
}

export async function saveSettings(patch: Partial<Settings>) {
  const repo = await getRepo();
  await repo.saveSettings(patch);
  refresh();
}

export async function saveOpeningPrice(symbol: string, price: number | null) {
  const repo = await getRepo();
  const view = await loadView();
  const openingPrices = { ...(view.data.settings.openingPrices ?? {}) };
  if (price == null || !Number.isFinite(price) || price <= 0) delete openingPrices[symbol];
  else openingPrices[symbol] = price;
  await repo.saveSettings({ openingPrices });
  refresh();
}

export async function savePastedPrices(text: string, asOf?: string) {
  const repo = await getRepo();
  const day = asOf || pktDate();
  const { quotes, skipped } = parsePasted(text, day);
  if (!quotes.length) return { saved: 0, skipped, error: 'Nothing in that paste looked like a symbol and a price.' };
  const saved = await repo.upsertPrices(quotesToPrices(quotes, 'manual paste'));
  refresh();
  return { saved, skipped, error: null as string | null };
}

export async function upsertWatch(symbol: string, targetBuy: number | null, targetSell: number | null, note: string | null) {
  const repo = await getRepo();
  await repo.upsertWatch({ symbol: symbol.toUpperCase(), target_buy: targetBuy, target_sell: targetSell, note });
  refresh();
}

export async function deleteWatch(symbol: string) {
  const repo = await getRepo();
  await repo.deleteWatch(symbol);
  refresh();
}

export async function addAlert(symbol: string, direction: 'above' | 'below', level: number) {
  const repo = await getRepo();
  await repo.addAlert({ symbol: symbol.toUpperCase(), direction, level, active: true, fired_at: null });
  refresh();
}

export async function setAlertActive(id: string, active: boolean) {
  const repo = await getRepo();
  await repo.updateAlert(id, { active, ...(active ? { fired_at: null } : {}) });
  refresh();
}

export async function deleteAlert(id: string) {
  const repo = await getRepo();
  await repo.deleteAlert(id);
  refresh();
}

export async function addPlan(input: {
  symbol: string;
  side: 'BUY' | 'SELL';
  qty: number;
  limitPrice: number | null;
  rationale: string | null;
}) {
  const repo = await getRepo();
  await repo.addPlan({
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    qty: input.qty,
    limit_price: input.limitPrice,
    rationale: input.rationale,
    status: 'draft',
    linked_txn: null,
  });
  refresh();
}

export async function setPlanStatus(id: string, status: 'draft' | 'placed' | 'cancelled') {
  const repo = await getRepo();
  await repo.updatePlan(id, { status });
  refresh();
}

export async function deletePlan(id: string) {
  const repo = await getRepo();
  await repo.deletePlan(id);
  refresh();
}

/**
 * Marks a plan filled and raises the cash book row from it, so a trade is never
 * typed twice. The row carries no broker balance, because the statement has not
 * been seen yet: the ledger will show it as unproved until it is.
 */
export async function fillPlan(id: string, tradeDate: string, actualPrice: number | null) {
  const repo = await getRepo();
  const view = await loadView();
  const plan = view.data.plans.find((p) => p.id === id);
  if (!plan) return { error: 'That plan is no longer in the book.' };
  if (plan.status === 'filled') return { error: 'That plan has already been filled.' };

  const costing = costPlan(
    { symbol: plan.symbol, side: plan.side, qty: plan.qty, limitPrice: actualPrice ?? plan.limit_price },
    view.book,
    view.cash,
    view.data.transactions,
    view.data.settings,
  );
  if (costing.price == null) return { error: 'The plan has no price to raise a cash book row from.' };

  const seq = Math.max(0, ...view.data.transactions.map((t) => t.seq)) + 1;
  const row = planToTxn(costing, tradeDate, seq) as Omit<Txn, 'id'>;
  const created = await repo.addTxn(row);
  await repo.updatePlan(id, { status: 'filled', linked_txn: created.id });
  refresh();
  return { error: null as string | null, txnId: created.id };
}

/**
 * Loads the shipped book into a newly connected Supabase project, as the
 * signed-in owner. Replaces the command line seed script, so setting the app
 * up never needs a terminal or a service role key.
 */
export async function importSeedBook() {
  const repo = await getRepo();
  if (repo.mode !== 'supabase') {
    return { error: 'There is no database connected to import into.', imported: null };
  }
  try {
    const imported = await repo.importSeed();
    refresh();
    return { error: null as string | null, imported };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e), imported: null };
  }
}

export async function deleteTxn(id: string) {
  const repo = await getRepo();
  await repo.deleteTxn(id);
  refresh();
}
