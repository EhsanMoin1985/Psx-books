'use client';

import { useState, useTransition } from 'react';
import { Money } from './money';
import { Badge, Empty, btn, btnPlainStyle } from './ui';
import { fmtDate, fmtPrice, fmtQty } from '@/lib/money';
import type { Plan } from '@/lib/types';
import { deletePlan, fillPlan, setPlanStatus } from '@/app/actions';

const TONE = { draft: 'plain', placed: 'accent', filled: 'pos', cancelled: 'plain' } as const;

export function PlanList({ plans, today }: { plans: Plan[]; today: string }) {
  const [pending, start] = useTransition();
  const [filling, setFilling] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!plans.length) return <Empty>No plans yet. Cost an order above and save it as a draft.</Empty>;

  return (
    <div className="overflow-x-auto">
      <table className="book">
        <thead>
          <tr>
            <th>Raised</th>
            <th>Symbol</th>
            <th>Side</th>
            <th className="num">Quantity</th>
            <th className="num">Limit</th>
            <th>Rationale</th>
            <th>Status</th>
            <th className="no-print">Action</th>
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <td className="whitespace-nowrap">{fmtDate(p.created_at.slice(0, 10))}</td>
              <td className="font-medium">{p.symbol}</td>
              <td><Badge tone={p.side === 'BUY' ? 'accent' : 'pos'}>{p.side}</Badge></td>
              <td className="num">{fmtQty(p.qty)}</td>
              <td className="num">{fmtPrice(p.limit_price)}</td>
              <td className="max-w-[18rem] truncate" style={{ color: 'var(--ink-3)' }}>{p.rationale ?? '—'}</td>
              <td><Badge tone={TONE[p.status]}>{p.status}</Badge></td>
              <td className="no-print">
                {p.status === 'filled' ? (
                  <span className="text-xs" style={{ color: 'var(--ink-3)' }}>ledger row raised</span>
                ) : filling === p.id ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <input type="date" className="w-36 py-1 text-[12px]" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Trade date" />
                    <input
                      type="number" step="0.01" className="w-24 py-1 text-[12px] num"
                      value={price} onChange={(e) => setPrice(e.target.value)}
                      placeholder={p.limit_price ? String(p.limit_price) : 'price'} aria-label="Fill price"
                    />
                    <button
                      type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
                      onClick={() => start(async () => {
                        const r = await fillPlan(p.id, date, price.trim() === '' ? null : Number(price));
                        if (r.error) setError(r.error);
                        else { setFilling(null); setPrice(''); setError(null); }
                      })}
                    >
                      Confirm fill
                    </button>
                    <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} onClick={() => { setFilling(null); setError(null); }}>Cancel</button>
                    {error && <span className="text-[12px] w-full" style={{ color: 'var(--neg)' }}>{error}</span>}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {p.status === 'draft' && (
                      <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
                        onClick={() => start(() => setPlanStatus(p.id, 'placed').then(() => undefined))}>
                        Mark placed
                      </button>
                    )}
                    {p.status !== 'cancelled' && (
                      <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle}
                        onClick={() => { setFilling(p.id); setPrice(p.limit_price ? String(p.limit_price) : ''); }}>
                        Mark filled
                      </button>
                    )}
                    {p.status !== 'cancelled' && (
                      <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
                        onClick={() => start(() => setPlanStatus(p.id, 'cancelled').then(() => undefined))}>
                        Cancel
                      </button>
                    )}
                    <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
                      onClick={() => start(() => deletePlan(p.id).then(() => undefined))}>
                      Delete
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
