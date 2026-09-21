/**
 * Loads the seed book into a Supabase project.
 *
 * Run schema.sql in the SQL editor first, then sign in once in the app so the
 * owner exists, then:
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OWNER_EMAIL=you@example.com \
 *     npm run seed
 *
 * It refuses to run against a project that already holds transactions unless
 * --force is passed, so it cannot quietly double up a book.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

interface RawTxn {
  id: string; date: string; type: string; amount: number; seq: number;
  voucher?: string; note?: string; source?: string; symbol?: string;
  qty?: number; price?: number; comm?: number; stmtBalance?: number;
  external?: boolean; gross?: number;
}

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ownerEmail = process.env.OWNER_EMAIL;
const force = process.argv.includes('--force');

function die(msg: string): never {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

if (!url) die('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL).');
if (!key) die('Set SUPABASE_SERVICE_ROLE_KEY. It is in the project API settings and must not be committed.');
if (!ownerEmail) die('Set OWNER_EMAIL to the address you sign in with, so the rows get an owner.');

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data: users, error: userErr } = await db.auth.admin.listUsers();
  if (userErr) die(`Could not list users: ${userErr.message}`);
  const owner = users.users.find((u) => u.email?.toLowerCase() === ownerEmail!.toLowerCase());
  if (!owner) die(`No user with email ${ownerEmail}. Sign in to the app once first, then run this again.`);
  console.log(`Owner: ${owner.email} (${owner.id})`);

  const { count } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('owner', owner.id);
  if (count && !force) {
    die(`That owner already has ${count} transactions. Pass --force to add these on top, or clear the table first.`);
  }

  const raw = JSON.parse(readFileSync(resolve(process.cwd(), 'psx-books-data.json'), 'utf8')) as {
    transactions: RawTxn[];
    settings: Record<string, unknown>;
  };

  // created_at carries statement order, because two rows can share a date.
  const base = Date.UTC(2020, 0, 1);
  const rows = raw.transactions
    .slice()
    .sort((a, b) => a.seq - b.seq)
    .map((t, i) => ({
      owner: owner.id,
      trade_date: t.date,
      type: t.type,
      symbol: t.symbol ?? null,
      qty: t.qty ?? null,
      price: t.price ?? null,
      commission: t.comm ?? 0,
      amount: t.amount,
      gross: t.gross ?? null,
      stmt_balance: t.stmtBalance ?? null,
      external: t.external ?? false,
      voucher: t.voucher ?? null,
      note: t.note ?? null,
      source: t.source ?? null,
      created_at: new Date(base + i * 1000).toISOString(),
    }));

  const { error: txErr } = await db.from('transactions').insert(rows);
  if (txErr) die(`Inserting transactions failed: ${txErr.message}`);
  console.log(`Inserted ${rows.length} transactions.`);

  const settings = raw.settings as { prices?: { px?: Record<string, number>; asOf?: Record<string, string>; source?: string } };
  const px = settings.prices?.px ?? {};
  const asOf = settings.prices?.asOf ?? {};
  const priceRows = Object.entries(px).map(([symbol, close]) => ({
    owner: owner.id,
    symbol,
    as_of: asOf[symbol] ?? new Date().toISOString().slice(0, 10),
    close,
    source: settings.prices?.source ?? 'seed',
  }));
  if (priceRows.length) {
    const { error } = await db.from('prices').upsert(priceRows, { onConflict: 'owner,symbol,as_of' });
    if (error) die(`Inserting prices failed: ${error.message}`);
    console.log(`Inserted ${priceRows.length} prices.`);
  }

  const { error: setErr } = await db.from('settings').upsert({ owner: owner.id, data: raw.settings });
  if (setErr) die(`Saving settings failed: ${setErr.message}`);
  console.log('Saved settings.');

  console.log('\nDone. Open the app and check the reconciliation page: cash should prove on every row.\n');
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)));
