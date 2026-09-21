'use client';

import { useState, useTransition } from 'react';
import { Badge, btn, btnPlainStyle, btnPrimary, btnPrimaryStyle } from './ui';
import { addAlert, deleteAlert, deleteWatch, setAlertActive, upsertWatch } from '@/app/actions';
import { fmtDate, fmtPrice } from '@/lib/money';
import type { Alert } from '@/lib/types';
import type { WatchStatus } from '@/lib/engine/alerts';

const num = (s: string) => (s.trim() === '' ? null : Number(s));

export function WatchForm({ symbols }: { symbols: string[] }) {
  const [symbol, setSymbol] = useState('');
  const [buy, setBuy] = useState('');
  const [sell, setSell] = useState('');
  const [note, setNote] = useState('');
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_2fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        if (!symbol.trim()) return;
        start(async () => {
          await upsertWatch(symbol.trim(), num(buy), num(sell), note.trim() || null);
          setSymbol(''); setBuy(''); setSell(''); setNote('');
        });
      }}
    >
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Symbol
        <input className="mt-1 text-[13px] normal-case" list="watch-symbols" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} required />
        <datalist id="watch-symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Target buy
        <input type="number" step="0.01" min="0" className="mt-1 text-[13px] num" value={buy} onChange={(e) => setBuy(e.target.value)} />
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Target sell
        <input type="number" step="0.01" min="0" className="mt-1 text-[13px] num" value={sell} onChange={(e) => setSell(e.target.value)} />
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Note
        <input className="mt-1 text-[13px] normal-case" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why you are watching it" />
      </label>
      <div className="flex items-end">
        <button type="submit" className={btnPrimary} style={btnPrimaryStyle} disabled={pending}>Save</button>
      </div>
    </form>
  );
}

export function WatchRowActions({ row }: { row: WatchStatus }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
      onClick={() => start(() => deleteWatch(row.symbol).then(() => undefined))}>
      Remove
    </button>
  );
}

export function AlertForm({ symbols }: { symbols: string[] }) {
  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'above' | 'below'>('below');
  const [level, setLevel] = useState('');
  const [pending, start] = useTransition();

  return (
    <form
      className="grid gap-2 md:grid-cols-[1fr_1fr_1fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const l = Number(level);
        if (!symbol.trim() || !Number.isFinite(l) || l <= 0) return;
        start(async () => {
          await addAlert(symbol.trim(), direction, l);
          setSymbol(''); setLevel('');
        });
      }}
    >
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Symbol
        <input className="mt-1 text-[13px] normal-case" list="alert-symbols" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} required />
        <datalist id="alert-symbols">{symbols.map((s) => <option key={s} value={s} />)}</datalist>
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        When the price goes
        <select className="mt-1 text-[13px] normal-case" value={direction} onChange={(e) => setDirection(e.target.value as 'above' | 'below')}>
          <option value="below">below</option>
          <option value="above">above</option>
        </select>
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Level
        <input type="number" step="0.01" min="0" className="mt-1 text-[13px] num" value={level} onChange={(e) => setLevel(e.target.value)} required />
      </label>
      <div className="flex items-end">
        <button type="submit" className={btnPrimary} style={btnPrimaryStyle} disabled={pending}>Add alert</button>
      </div>
    </form>
  );
}

export function AlertRow({ a, close }: { a: Alert; close: number | null }) {
  const [pending, start] = useTransition();
  const armed = a.active && !a.fired_at;
  return (
    <tr>
      <td className="font-medium">{a.symbol}</td>
      <td>{a.direction === 'above' ? 'rises above' : 'falls below'}</td>
      <td className="num">{fmtPrice(a.level)}</td>
      <td className="num">{fmtPrice(close)}</td>
      <td>
        {armed ? <Badge tone="accent">armed</Badge>
          : a.fired_at ? <Badge tone="pos">fired {fmtDate(a.fired_at.slice(0, 10))}</Badge>
          : <Badge tone="plain">off</Badge>}
      </td>
      <td className="no-print">
        <div className="flex gap-1.5">
          <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
            onClick={() => start(() => setAlertActive(a.id, !armed).then(() => undefined))}>
            {armed ? 'Switch off' : 'Arm again'}
          </button>
          <button type="button" className={`${btn} px-2 py-1`} style={btnPlainStyle} disabled={pending}
            onClick={() => start(() => deleteAlert(a.id).then(() => undefined))}>
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
