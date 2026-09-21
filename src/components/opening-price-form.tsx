'use client';

import { useState, useTransition } from 'react';
import { btn, btnPlainStyle } from './ui';
import { saveOpeningPrice } from '@/app/actions';

/**
 * The 31 December 2025 closing price for a holding carried in from before the
 * books open. Entering one gives those units a deemed cost, which moves the
 * split between opening equity and gain without moving any total.
 */
export function OpeningPriceForm({ symbol, value }: { symbol: string; value: number | null }) {
  const [price, setPrice] = useState(value == null ? '' : String(value));
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        const n = price.trim() === '' ? null : Number(price);
        start(async () => {
          await saveOpeningPrice(symbol, n);
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        });
      }}
    >
      <input
        type="number"
        step="0.0001"
        min="0"
        className="w-28 py-1 text-[13px] num"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        aria-label={`${symbol} closing price at 31 December 2025`}
        placeholder="not set"
      />
      <button type="submit" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}>
        {pending ? '…' : saved ? 'Saved' : 'Save'}
      </button>
    </form>
  );
}
