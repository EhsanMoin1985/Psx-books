'use client';

import { useState, useTransition } from 'react';
import { Money } from './money';
import { Badge, Note, Panel, btn, btnPlainStyle, btnPrimary, btnPrimaryStyle } from './ui';
import { fmtPct, fmtPrice, fmtQty } from '@/lib/money';
import type { PlanCosting } from '@/lib/engine/planner';
import { addPlan } from '@/app/actions';

export interface PlannerOption {
  symbol: string;
  qty: number;
  close: number | null;
  avgCost: number | null;
}

/**
 * Costs an order before it is placed. The figures come from the server so they
 * use the same engine as every other screen, never a second implementation.
 */
export function PlannerForm({
  options,
  symbols,
  cash,
  cost,
}: {
  options: PlannerOption[];
  symbols: string[];
  cash: number;
  cost: (input: { symbol: string; side: 'BUY' | 'SELL'; qty: number; limitPrice: number | null }) => Promise<PlanCosting | null>;
}) {
  const [symbol, setSymbol] = useState(symbols[0] ?? '');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('');
  const [limit, setLimit] = useState('');
  const [rationale, setRationale] = useState('');
  const [result, setResult] = useState<PlanCosting | null>(null);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  const held = options.find((o) => o.symbol === symbol);

  const run = (overrides?: { qty?: string; limit?: string; symbol?: string; side?: 'BUY' | 'SELL' }) => {
    const q = Number(overrides?.qty ?? qty);
    const s = overrides?.symbol ?? symbol;
    const sd = overrides?.side ?? side;
    const l = overrides?.limit ?? limit;
    if (!s || !Number.isFinite(q) || q <= 0) {
      setResult(null);
      return;
    }
    start(async () => {
      setResult(await cost({ symbol: s, side: sd, qty: q, limitPrice: l.trim() === '' ? null : Number(l) }));
      setSaved(false);
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <Panel title="Order" subtitle="Nothing here is sent to the broker">
        <div className="space-y-3">
          <label className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Symbol
            <input
              className="mt-1 text-[13px] normal-case"
              list="planner-symbols"
              value={symbol}
              onChange={(e) => { const s = e.target.value.toUpperCase(); setSymbol(s); run({ symbol: s }); }}
            />
            <datalist id="planner-symbols">
              {symbols.map((s) => <option key={s} value={s} />)}
            </datalist>
          </label>

          <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Side
            <div className="mt-1 inline-flex w-full overflow-hidden rounded border" style={{ borderColor: 'var(--line-strong)' }}>
              {(['BUY', 'SELL'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => { setSide(s); run({ side: s }); }}
                  aria-pressed={side === s}
                  className="flex-1 py-1.5 text-[13px] normal-case"
                  style={side === s ? { background: 'var(--accent)', color: 'var(--accent-ink)', fontWeight: 600 } : { background: 'var(--panel)', color: 'var(--ink-2)' }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Quantity
            <input
              type="number" min="0" step="1" inputMode="numeric"
              className="mt-1 text-[13px] num"
              value={qty}
              onChange={(e) => { setQty(e.target.value); run({ qty: e.target.value }); }}
            />
            {held && side === 'SELL' && (
              <span className="mt-1 block normal-case" style={{ color: 'var(--ink-3)' }}>
                {fmtQty(held.qty)} held ·{' '}
                <button type="button" className="underline" onClick={() => { setQty(String(held.qty)); run({ qty: String(held.qty) }); }}>sell all</button>
              </span>
            )}
          </label>

          <label className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Limit price
            <input
              type="number" min="0" step="0.01" inputMode="decimal"
              className="mt-1 text-[13px] num"
              value={limit}
              placeholder={held?.close != null ? `last ${fmtPrice(held.close)}` : 'required if never priced'}
              onChange={(e) => { setLimit(e.target.value); run({ limit: e.target.value }); }}
            />
          </label>

          <label className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Rationale
            <textarea
              rows={3}
              className="mt-1 text-[13px] normal-case"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              placeholder="Why this order, and what would change your mind"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className={btnPrimary}
              style={btnPrimaryStyle}
              disabled={!result || pending}
              onClick={() => start(async () => {
                if (!result) return;
                await addPlan({ symbol, side, qty: Number(qty), limitPrice: limit.trim() === '' ? null : Number(limit), rationale: rationale.trim() || null });
                setSaved(true);
                setQty(''); setLimit(''); setRationale(''); setResult(null);
              })}
            >
              Save as a draft plan
            </button>
            {saved && <span className="text-[12px]" style={{ color: 'var(--pos)' }}>Saved.</span>}
          </div>
        </div>
      </Panel>

      <Panel title="What this order would do" subtitle={pending ? 'Working…' : undefined}>
        {!result ? (
          <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>
            Enter a symbol and a quantity to cost the order.
          </p>
        ) : (
          <div className="space-y-4">
            {result.warnings.length > 0 && (
              <Note tone="warn">
                <ul className="list-disc pl-4 space-y-0.5">
                  {result.warnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              </Note>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <table className="book">
                <thead><tr><th colSpan={2}>Consideration</th></tr></thead>
                <tbody>
                  <tr><td>{fmtQty(result.qty)} at {fmtPrice(result.price)}</td><td className="num"><Money value={result.gross} /></td></tr>
                  <tr><td>Commission at {result.tariff.commissionPct}%</td><td className="num"><Money value={result.commission} /></td></tr>
                  <tr><td>CVT and levies at {result.tariff.leviesPct}%</td><td className="num"><Money value={result.levies} /></td></tr>
                  <tr>
                    <td className="rule-top font-semibold">{result.side === 'BUY' ? 'Cash to settle' : 'Cash to receive'}</td>
                    <td className="num rule-top font-semibold"><Money value={Math.abs(result.netAmount)} /></td>
                  </tr>
                </tbody>
              </table>

              <table className="book">
                <thead><tr><th colSpan={2}>Position and cash</th></tr></thead>
                <tbody>
                  <tr><td>Cash at broker now</td><td className="num"><Money value={cash} /></td></tr>
                  <tr>
                    <td>Cash after settlement</td>
                    <td className="num"><Money value={result.cashAfter} colour /></td>
                  </tr>
                  <tr><td>Units held</td><td className="num">{fmtQty(result.qtyBefore)} → {fmtQty(result.qtyAfter)}</td></tr>
                  <tr>
                    <td>Share of portfolio</td>
                    <td className="num">{fmtPct(result.weightBefore)} → {fmtPct(result.weightAfter)}</td>
                  </tr>
                  <tr>
                    <td>{result.sector ?? 'Sector'} weight</td>
                    <td className="num">{fmtPct(result.sectorWeightBefore)} → {fmtPct(result.sectorWeightAfter)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {result.side === 'SELL' && result.gain != null && (
              <table className="book">
                <thead><tr><th colSpan={2}>Gain and tax if it fills</th></tr></thead>
                <tbody>
                  <tr><td>Cost relieved at weighted average</td><td className="num"><Money value={result.costRelieved} /></td></tr>
                  <tr>
                    <td>Gain on disposal</td>
                    <td className="num"><Money value={result.gain} colour signed /></td>
                  </tr>
                  <tr>
                    <td>
                      Capital gains tax at 15% <Badge tone="warn">estimate</Badge>
                    </td>
                    <td className="num"><Money value={result.cgtEstimate} /></td>
                  </tr>
                  <tr>
                    <td className="rule-top font-semibold">Net of the estimated tax</td>
                    <td className="num rule-top font-semibold"><Money value={Math.round((result.netAmount - (result.cgtEstimate ?? 0)) * 100) / 100} /></td>
                  </tr>
                </tbody>
              </table>
            )}

            <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
              Commission and levy rates are the ones your own {result.tariff.sample} trades have actually borne, not a
              published tariff. NCCPL bills capital gains tax monthly in arrears on its own matching, so the tax shown is
              the book&apos;s estimate at the statutory rate.
            </p>
          </div>
        )}
      </Panel>
    </div>
  );
}
