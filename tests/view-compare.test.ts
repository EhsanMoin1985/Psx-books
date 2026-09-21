import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { seedBook } from '@/lib/data/seed';
import { buildBook } from '@/lib/engine/holdings';

/**
 * The `holdings` view in schema.sql must give the same cost as the engine, or
 * ad-hoc SQL would contradict every screen. The CSV is produced by
 * scripts/verify-view.sh against a real Postgres; when it is absent the case
 * is skipped rather than passing quietly.
 */
const CSV = process.env.VIEW_CSV ?? '';

describe('the SQL holdings view agrees with the engine', () => {
  it.skipIf(!CSV || !existsSync(CSV))('matches cost and quantity for every symbol', () => {
    const { transactions, prices, settings } = seedBook();
    const book = buildBook(transactions, prices, settings);
    const fromSql = new Map(
      readFileSync(CSV, 'utf8').trim().split('\n').map((l) => {
        const [symbol, cost, qty] = l.split(',');
        return [symbol, { cost: Number(cost), qty: Number(qty) }] as const;
      }),
    );
    expect([...fromSql.keys()].sort()).toEqual(book.holdings.map((h) => h.symbol).sort());
    for (const h of book.holdings) {
      expect([h.symbol, fromSql.get(h.symbol)!.cost]).toEqual([h.symbol, h.cost]);
      expect([h.symbol, fromSql.get(h.symbol)!.qty]).toEqual([h.symbol, h.qty]);
    }
  });
});
