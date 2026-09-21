'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Money } from '@/components/money';
import { Badge, Empty, btn, btnPlainStyle } from '@/components/ui';
import { fmtDate, fmtPrice, fmtQty } from '@/lib/money';
import { TXN_TYPES, type TxnType } from '@/lib/types';
import type { LedgerRow } from '@/lib/engine/ledger';

/**
 * The cash book. The balance column is recomputed from the opening row, never
 * read from the statement, and each row says whether the two agree.
 */
export function LedgerTable({ rows, symbols }: { rows: LedgerRow[]; symbols: string[] }) {
  const [type, setType] = useState<TxnType | ''>('');
  const [symbol, setSymbol] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [text, setText] = useState('');
  const [onlyUnproved, setOnlyUnproved] = useState(false);

  const filtered = useMemo(() => {
    const q = text.trim().toLowerCase();
    return rows.filter((r) => {
      if (type && r.type !== type) return false;
      if (symbol && r.symbol !== symbol) return false;
      if (from && r.trade_date < from) return false;
      if (to && r.trade_date > to) return false;
      if (onlyUnproved && (r.stmt_balance == null || r.proved)) return false;
      if (q) {
        const hay = `${r.voucher ?? ''} ${r.note ?? ''} ${r.symbol ?? ''} ${r.type} ${r.source ?? ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, type, symbol, from, to, text, onlyUnproved]);

  const totals = useMemo(() => {
    let debits = 0;
    let credits = 0;
    for (const r of filtered) {
      if (r.external) continue;
      if (r.amount < 0) debits += -r.amount;
      else credits += r.amount;
    }
    return { debits: Math.round(debits * 100) / 100, credits: Math.round(credits * 100) / 100 };
  }, [filtered]);

  const exportCsv = () => {
    const head = [
      'date', 'voucher', 'type', 'symbol', 'qty', 'price', 'commission',
      'amount', 'gross', 'running_balance', 'broker_balance', 'drift', 'external', 'note', 'source',
    ];
    const esc = (x: unknown) => {
      const s = x == null ? '' : String(x);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const body = filtered.map((r) =>
      [r.trade_date, r.voucher, r.type, r.symbol, r.qty, r.price, r.commission,
       r.amount, r.gross, r.running, r.stmt_balance, r.drift, r.external, r.note, r.source].map(esc).join(','),
    );
    const blob = new Blob([[head.join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `psx-books-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setType(''); setSymbol(''); setFrom(''); setTo(''); setText(''); setOnlyUnproved(false);
  };

  return (
    <>
      <div className="no-print panel mb-4 p-3">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
          <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Type
            <select className="mt-1 text-[13px] normal-case" value={type} onChange={(e) => setType(e.target.value as TxnType | '')}>
              <option value="">All</option>
              {TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Symbol
            <select className="mt-1 text-[13px] normal-case" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              <option value="">All</option>
              {symbols.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            From
            <input type="date" className="mt-1 text-[13px]" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            To
            <input type="date" className="mt-1 text-[13px]" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <label className="col-span-2 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
            Search voucher or note
            <input className="mt-1 text-[13px] normal-case" value={text} onChange={(e) => setText(e.target.value)} placeholder="RAAST, CGT, CV0700…" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[13px]">
            <input type="checkbox" className="w-auto" checked={onlyUnproved} onChange={(e) => setOnlyUnproved(e.target.checked)} />
            Only rows that do not prove
          </label>
          <button type="button" className={btn} style={btnPlainStyle} onClick={reset}>Clear</button>
          <button type="button" className={btn} style={btnPlainStyle} onClick={exportCsv}>Export CSV</button>
          <span className="ml-auto text-[12px]" style={{ color: 'var(--ink-3)' }}>
            {filtered.length} of {rows.length} rows
          </span>
        </div>
      </div>

      <div className="panel overflow-x-auto">
        {filtered.length === 0 ? (
          <Empty>No rows match those filters.</Empty>
        ) : (
          <table className="book">
            <thead>
              <tr>
                <th>Date</th>
                <th>Voucher</th>
                <th>Type</th>
                <th>Detail</th>
                <th className="num">Quantity</th>
                <th className="num">Price</th>
                <th className="num">Amount</th>
                <th className="num">Balance</th>
                <th className="num">Broker</th>
                <th>Proof</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{fmtDate(r.trade_date)}</td>
                  <td style={{ color: 'var(--ink-3)' }}>{r.voucher ?? '—'}</td>
                  <td><Badge tone={r.type === 'BUY' ? 'accent' : r.type === 'SELL' ? 'pos' : r.type === 'CGT' || r.type === 'FEE' ? 'neg' : 'plain'}>{r.type}</Badge></td>
                  <td className="max-w-[20rem]">
                    {r.symbol ? (
                      <Link href={`/holdings/${r.symbol}`} className="font-medium underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>{r.symbol}</Link>
                    ) : null}
                    {r.note && <span className={r.symbol ? 'ml-1.5' : ''} style={{ color: 'var(--ink-3)' }}>{r.note}</span>}
                    {r.external && <span className="ml-1.5"><Badge tone="warn">outside broker</Badge></span>}
                  </td>
                  <td className="num">{fmtQty(r.qty)}</td>
                  <td className="num">{fmtPrice(r.price)}</td>
                  <td className="num"><Money value={r.amount} colour /></td>
                  <td className="num">{r.running == null ? <span style={{ color: 'var(--ink-3)' }}>—</span> : <Money value={r.running} />}</td>
                  <td className="num" style={{ color: 'var(--ink-3)' }}>{r.stmt_balance == null ? '—' : <Money value={r.stmt_balance} />}</td>
                  <td>
                    {r.external ? <span style={{ color: 'var(--ink-3)' }} className="text-xs">not in the statement</span>
                      : r.stmt_balance == null ? <Badge tone="warn">no broker balance</Badge>
                      : r.proved ? <Badge tone="pos">agrees</Badge>
                      : <Badge tone="neg">out by {r.drift?.toFixed(2)}</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={6}>
                  Debits <Money value={totals.debits} /> · Credits <Money value={totals.credits} />
                </td>
                <td className="num"><Money value={Math.round((totals.credits - totals.debits) * 100) / 100} colour /></td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}
