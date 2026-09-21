import { describe, expect, it } from 'vitest';
import { alertEmail, crossings, watchStatus } from '@/lib/engine/alerts';
import type { Alert } from '@/lib/types';

const latest = { UBL: { close: 430.8, asOf: '2026-09-18' }, PSX: { close: 45.5, asOf: '2026-09-18' } };
const alert = (o: Partial<Alert>): Alert => ({
  id: 'a', symbol: 'UBL', direction: 'below', level: 440, active: true, fired_at: null, ...o,
});

describe('price alerts', () => {
  it('fires when the level is crossed, in either direction', () => {
    expect(crossings([alert({ direction: 'below', level: 440 })], latest)).toHaveLength(1);
    expect(crossings([alert({ direction: 'below', level: 400 })], latest)).toHaveLength(0);
    expect(crossings([alert({ direction: 'above', level: 420 })], latest)).toHaveLength(1);
    expect(crossings([alert({ direction: 'above', level: 450 })], latest)).toHaveLength(0);
  });

  it('treats the level itself as crossed', () => {
    expect(crossings([alert({ direction: 'below', level: 430.8 })], latest)).toHaveLength(1);
    expect(crossings([alert({ direction: 'above', level: 430.8 })], latest)).toHaveLength(1);
  });

  it('stays quiet once it has fired, and while switched off', () => {
    expect(crossings([alert({ fired_at: '2026-09-18T00:00:00Z' })], latest)).toHaveLength(0);
    expect(crossings([alert({ active: false })], latest)).toHaveLength(0);
  });

  it('ignores a symbol with no stored price rather than guessing', () => {
    expect(crossings([alert({ symbol: 'NOPE' })], latest)).toHaveLength(0);
  });

  it('writes an email that names the symbol, the level and the price', () => {
    const { subject, text } = alertEmail(crossings([alert({})], latest), '2026-09-18');
    expect(subject).toBe('PSX Books: UBL below 440.00');
    expect(text).toContain('UBL  fell to 430.80');
    expect(text).toContain('alert set below 440.00');
    expect(text).toContain('switched off so it does not repeat');
  });
});

describe('the watchlist', () => {
  const rows = watchStatus(
    [
      { symbol: 'UBL', target_buy: 400, target_sell: 500, note: null },
      { symbol: 'PSX', target_buy: 50, target_sell: 70, note: 'accumulating' },
      { symbol: 'NOPE', target_buy: 10, target_sell: 20, note: null },
    ],
    latest,
    { UBL: 1500 },
  );

  it('measures the distance to each target from the stored price', () => {
    const ubl = rows.find((r) => r.symbol === 'UBL')!;
    expect(ubl.close).toBe(430.8);
    expect(ubl.toBuy).toBe(-7.15);   // 7.15% below the last price
    expect(ubl.toSell).toBe(16.06);
    expect(ubl.atBuy).toBe(false);
    expect(ubl.held).toBe(1500);
  });

  it('flags a symbol already at its target and sorts it first', () => {
    expect(rows[0].symbol).toBe('PSX');
    expect(rows[0].atBuy).toBe(true);
    expect(rows[0].held).toBe(0);
  });

  it('leaves an unpriced symbol blank rather than at zero', () => {
    const none = rows.find((r) => r.symbol === 'NOPE')!;
    expect(none.close).toBeNull();
    expect(none.toBuy).toBeNull();
    expect(none.atBuy).toBe(false);
  });
});
