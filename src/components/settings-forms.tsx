'use client';

import { useState, useTransition } from 'react';
import { Note, btn, btnPlainStyle, btnPrimary, btnPrimaryStyle } from './ui';
import { saveSettings, savePastedPrices } from '@/app/actions';
import type { Settings } from '@/lib/types';

/** Paste prices from the InvestPro portfolio screen. */
export function PastePricesForm({ today, symbols }: { today: string; symbols: string[] }) {
  const [text, setText] = useState('');
  const [asOf, setAsOf] = useState(today);
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ saved: number; skipped: string[]; error: string | null } | null>(null);

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await savePastedPrices(text, asOf);
          setResult(r);
          if (!r.error) setText('');
        });
      }}
    >
      <label className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Prices
        <textarea
          rows={7}
          className="mt-1 text-[13px] normal-case font-mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`${symbols.slice(0, 3).join(', 0.00\n')}, 0.00\n\nOne symbol and price per line. Commas, tabs or spaces all work.\nA date in the line overrides the date below.`}
        />
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
          Priced at
          <input type="date" className="mt-1 w-44 text-[13px]" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </label>
        <button type="submit" className={btnPrimary} style={btnPrimaryStyle} disabled={pending || !text.trim()}>
          {pending ? 'Saving…' : 'Store these prices'}
        </button>
      </div>
      {result && (
        <Note tone={result.error ? 'warn' : 'plain'}>
          {result.error ?? `Stored ${result.saved} price${result.saved === 1 ? '' : 's'} at ${asOf}.`}
          {result.skipped.length > 0 && (
            <> {result.skipped.length} line{result.skipped.length === 1 ? '' : 's'} could not be read and{' '}
              {result.skipped.length === 1 ? 'was' : 'were'} skipped: {result.skipped.slice(0, 5).join('; ')}.</>
          )}
        </Note>
      )}
    </form>
  );
}

export function FxForm({ fx }: { fx: Settings['fx'] }) {
  const [rate, setRate] = useState(fx?.rate == null ? '' : String(fx.rate));
  const [asOf, setAsOf] = useState(fx?.asOf ?? '');
  const [source, setSource] = useState(fx?.source ?? '');
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]"
      onSubmit={(e) => {
        e.preventDefault();
        const r = Number(rate);
        if (!Number.isFinite(r) || r <= 0) return;
        start(async () => {
          await saveSettings({ fx: { rate: r, asOf: asOf || undefined, source: source || undefined } });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        });
      }}
    >
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Rupees to the dollar
        <input type="number" step="0.01" min="0" className="mt-1 text-[13px] num" value={rate} onChange={(e) => setRate(e.target.value)} required />
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Rate at
        <input type="date" className="mt-1 text-[13px]" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
      </label>
      <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Source
        <input className="mt-1 text-[13px] normal-case" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Wise mid-market" />
      </label>
      <div className="flex items-end gap-2">
        <button type="submit" className={btn} style={btnPlainStyle} disabled={pending}>Save</button>
        {saved && <span className="text-[12px] pb-1.5" style={{ color: 'var(--pos)' }}>Saved.</span>}
      </div>
    </form>
  );
}

export function SectorForm({ symbols, sectors }: { symbols: string[]; sectors: Record<string, string> }) {
  const [draft, setDraft] = useState(sectors);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          await saveSettings({ sectors: draft });
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        });
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {symbols.map((s) => (
          <label key={s} className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            {s}
            <input
              className="mt-1 text-[13px] normal-case"
              value={draft[s] ?? ''}
              placeholder={sectors[s] ?? 'Unclassified'}
              onChange={(e) => setDraft({ ...draft, [s]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button type="submit" className={btn} style={btnPlainStyle} disabled={pending}>Save sectors</button>
        {saved && <span className="text-[12px]" style={{ color: 'var(--pos)' }}>Saved.</span>}
      </div>
    </form>
  );
}
