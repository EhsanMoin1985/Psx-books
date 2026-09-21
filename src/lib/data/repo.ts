import 'server-only';
import type { Alert, BookData, Plan, Price, Settings, Txn, WatchRow } from '../types';
import { supabaseConfigured } from '../supabase/config';
import { supabaseServer } from '../supabase/server';
import { seedBook } from './seed';

export type Mode = 'supabase' | 'local';

export interface Repo {
  mode: Mode;
  load(): Promise<BookData>;
  addTxn(t: Omit<Txn, 'id'>): Promise<Txn>;
  updateTxn(id: string, patch: Partial<Txn>): Promise<void>;
  deleteTxn(id: string): Promise<void>;
  upsertPrices(prices: Price[]): Promise<number>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  upsertWatch(w: WatchRow): Promise<void>;
  deleteWatch(symbol: string): Promise<void>;
  addAlert(a: Omit<Alert, 'id'>): Promise<void>;
  updateAlert(id: string, patch: Partial<Alert>): Promise<void>;
  deleteAlert(id: string): Promise<void>;
  addPlan(p: Omit<Plan, 'id' | 'created_at'>): Promise<Plan>;
  updatePlan(id: string, patch: Partial<Plan>): Promise<void>;
  deletePlan(id: string): Promise<void>;
}

const uid = () => globalThis.crypto.randomUUID();

/**
 * The seed book, held in the server process.
 *
 * This is what runs before a Supabase project is connected, so the whole app
 * can be used and checked against the real figures. Edits last as long as the
 * process does and go no further, which every screen says plainly.
 */
let local: BookData | null = null;

function localBook(): BookData {
  return (local ??= seedBook());
}

/** Exported for tests, which need a clean book per case. */
export function resetLocal() {
  local = null;
}

const nextSeq = (b: BookData) => Math.max(0, ...b.transactions.map((t) => t.seq)) + 1;

class LocalRepo implements Repo {
  mode: Mode = 'local';
  async load() {
    const b = localBook();
    return {
      transactions: [...b.transactions],
      prices: [...b.prices],
      settings: { ...b.settings },
      watchlist: [...b.watchlist],
      alerts: [...b.alerts],
      plans: [...b.plans],
    };
  }
  async addTxn(t: Omit<Txn, 'id'>) {
    const b = localBook();
    const row: Txn = { ...t, id: uid(), seq: t.seq || nextSeq(b) };
    b.transactions.push(row);
    return row;
  }
  async updateTxn(id: string, patch: Partial<Txn>) {
    const b = localBook();
    const i = b.transactions.findIndex((t) => t.id === id);
    if (i >= 0) b.transactions[i] = { ...b.transactions[i], ...patch };
  }
  async deleteTxn(id: string) {
    const b = localBook();
    b.transactions = b.transactions.filter((t) => t.id !== id);
  }
  async upsertPrices(prices: Price[]) {
    const b = localBook();
    for (const p of prices) {
      const i = b.prices.findIndex((x) => x.symbol === p.symbol && x.as_of === p.as_of);
      if (i >= 0) b.prices[i] = p;
      else b.prices.push(p);
    }
    return prices.length;
  }
  async saveSettings(patch: Partial<Settings>) {
    const b = localBook();
    b.settings = { ...b.settings, ...patch };
  }
  async upsertWatch(w: WatchRow) {
    const b = localBook();
    const i = b.watchlist.findIndex((x) => x.symbol === w.symbol);
    if (i >= 0) b.watchlist[i] = w;
    else b.watchlist.push(w);
  }
  async deleteWatch(symbol: string) {
    const b = localBook();
    b.watchlist = b.watchlist.filter((w) => w.symbol !== symbol);
  }
  async addAlert(a: Omit<Alert, 'id'>) {
    localBook().alerts.push({ ...a, id: uid() });
  }
  async updateAlert(id: string, patch: Partial<Alert>) {
    const b = localBook();
    const i = b.alerts.findIndex((x) => x.id === id);
    if (i >= 0) b.alerts[i] = { ...b.alerts[i], ...patch };
  }
  async deleteAlert(id: string) {
    const b = localBook();
    b.alerts = b.alerts.filter((x) => x.id !== id);
  }
  async addPlan(p: Omit<Plan, 'id' | 'created_at'>) {
    const row: Plan = { ...p, id: uid(), created_at: new Date().toISOString() };
    localBook().plans.push(row);
    return row;
  }
  async updatePlan(id: string, patch: Partial<Plan>) {
    const b = localBook();
    const i = b.plans.findIndex((x) => x.id === id);
    if (i >= 0) b.plans[i] = { ...b.plans[i], ...patch };
  }
  async deletePlan(id: string) {
    const b = localBook();
    b.plans = b.plans.filter((x) => x.id !== id);
  }
}

type Client = NonNullable<Awaited<ReturnType<typeof supabaseServer>>>;

class SupabaseRepo implements Repo {
  mode: Mode = 'supabase';
  constructor(private readonly db: Client) {}

  private async must<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<T> {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data;
  }

  async load(): Promise<BookData> {
    const [txns, prices, settings, watchlist, alerts, plans] = await Promise.all([
      this.must(this.db.from('transactions').select('*')),
      this.must(this.db.from('prices').select('*')),
      this.must(this.db.from('settings').select('data').maybeSingle()),
      this.must(this.db.from('watchlist').select('*')),
      this.must(this.db.from('alerts').select('*')),
      this.must(this.db.from('plans').select('*')),
    ]);
    // `seq` is not a column; statement order within a day comes from created_at.
    const rows = (txns ?? []) as (Txn & { created_at: string })[];
    const ordered = rows
      .slice()
      .sort((a, b) =>
        a.trade_date === b.trade_date
          ? String(a.created_at).localeCompare(String(b.created_at))
          : a.trade_date < b.trade_date ? -1 : 1,
      )
      .map((t, i) => ({ ...t, seq: i + 1 }));
    return {
      transactions: ordered,
      prices: (prices ?? []) as Price[],
      settings: ((settings as { data?: Settings } | null)?.data ?? {}) as Settings,
      watchlist: (watchlist ?? []) as WatchRow[],
      alerts: (alerts ?? []) as Alert[],
      plans: (plans ?? []) as Plan[],
    };
  }

  async addTxn(t: Omit<Txn, 'id'>) {
    const { seq: _seq, ...row } = t;
    return (await this.must(this.db.from('transactions').insert(row).select().single())) as Txn;
  }
  async updateTxn(id: string, patch: Partial<Txn>) {
    const { seq: _seq, id: _id, ...row } = patch;
    await this.must(this.db.from('transactions').update(row).eq('id', id).select());
  }
  async deleteTxn(id: string) {
    await this.must(this.db.from('transactions').delete().eq('id', id).select());
  }
  async upsertPrices(prices: Price[]) {
    if (!prices.length) return 0;
    await this.must(this.db.from('prices').upsert(prices, { onConflict: 'owner,symbol,as_of' }).select());
    return prices.length;
  }
  async saveSettings(patch: Partial<Settings>) {
    const current = (await this.must(this.db.from('settings').select('data').maybeSingle())) as { data?: Settings } | null;
    await this.must(this.db.from('settings').upsert({ data: { ...(current?.data ?? {}), ...patch } }).select());
  }
  async upsertWatch(w: WatchRow) {
    await this.must(this.db.from('watchlist').upsert(w, { onConflict: 'owner,symbol' }).select());
  }
  async deleteWatch(symbol: string) {
    await this.must(this.db.from('watchlist').delete().eq('symbol', symbol).select());
  }
  async addAlert(a: Omit<Alert, 'id'>) {
    await this.must(this.db.from('alerts').insert(a).select());
  }
  async updateAlert(id: string, patch: Partial<Alert>) {
    await this.must(this.db.from('alerts').update(patch).eq('id', id).select());
  }
  async deleteAlert(id: string) {
    await this.must(this.db.from('alerts').delete().eq('id', id).select());
  }
  async addPlan(p: Omit<Plan, 'id' | 'created_at'>) {
    return (await this.must(this.db.from('plans').insert(p).select().single())) as Plan;
  }
  async updatePlan(id: string, patch: Partial<Plan>) {
    await this.must(this.db.from('plans').update(patch).eq('id', id).select());
  }
  async deletePlan(id: string) {
    await this.must(this.db.from('plans').delete().eq('id', id).select());
  }
}

export async function getRepo(): Promise<Repo> {
  if (!supabaseConfigured) return new LocalRepo();
  const db = await supabaseServer();
  if (!db) return new LocalRepo();
  const { data } = await db.auth.getUser();
  // Without a signed-in owner every RLS policy returns nothing, which would
  // read as an empty book. Fall back to the seed and say so.
  if (!data.user) return new LocalRepo();
  return new SupabaseRepo(db);
}

export async function currentMode(): Promise<Mode> {
  return (await getRepo()).mode;
}
