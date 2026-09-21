import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Money } from '@/components/money';
import { Badge, Note, Panel, PageHeader, Stat } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { symbolLedger } from '@/lib/engine/holdings';
import { sectorOf } from '@/lib/engine/planner';
import { fmtDate, fmtPct, fmtPrice, fmtQty } from '@/lib/money';

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return { title: symbol.toUpperCase() };
}

export const dynamic = 'force-dynamic';

export default async function SymbolPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol: raw } = await params;
  const symbol = decodeURIComponent(raw).toUpperCase();
  const v = await loadView();

  const held = v.book.holdings.find((h) => h.symbol === symbol);
  const closed = v.book.closed.find((h) => h.symbol === symbol);
  const h = held ?? closed;
  if (!h) notFound();

  const { opening, rows } = symbolLedger(v.data.transactions, symbol);
  const disposals = v.book.disposals.filter((d) => d.symbol === symbol);
  const realised = disposals.reduce((a, d) => a + d.gainNet, 0);

  return (
    <>
      <PageHeader
        title={symbol}
        lede={
          <>
            {sectorOf(symbol, v.data.settings) ?? 'Unclassified'} ·{' '}
            {held ? `${fmtQty(h.qty)} held` : 'position closed'} ·{' '}
            <Link href="/holdings" className="underline underline-offset-2">back to holdings</Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Quantity" value={fmtQty(h.qty)} sub={opening > 0 ? `${fmtQty(opening)} carried in from before 2026` : undefined} />
        <Stat label="Average cost" value={fmtPrice(h.avgCost) } sub={h.close != null ? `Last ${fmtPrice(h.close)} at ${fmtDate(h.asOf)}` : 'No stored price'} />
        <Stat label="Unrealised" value={<Money value={h.unrealised} signed />} tone={(h.unrealised ?? 0) >= 0 ? 'pos' : 'neg'} sub={fmtPct(h.unrealisedPct) + ' on cost'} />
        <Stat label="Realised to date" value={<Money value={realised} signed />} tone={realised >= 0 ? 'pos' : 'neg'} sub={`${disposals.length} disposals`} />
      </div>

      {opening > 0 && (
        <div className="mb-4">
          <Note tone="warn">
            {fmtQty(opening)} units were held before the books open, so the data carries no purchase for them. Their
            disposals book proceeds and no gain. Enter their 31 December 2025 closing price on the{' '}
            <Link href="/reconcile" className="underline underline-offset-2">reconciliation</Link> to give them a deemed
            cost.
          </Note>
        </div>
      )}

      <Panel title="Every trade in this symbol" subtitle="Oldest first, with the position and cost after each row" flush className="mb-4">
        <div className="overflow-x-auto">
          <table className="book">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Voucher</th>
                <th className="num">Quantity</th>
                <th className="num">Price</th>
                <th className="num">Commission</th>
                <th className="num">Net amount</th>
                <th className="num">Position</th>
                <th className="num">Cost held</th>
                <th className="num">Average</th>
              </tr>
            </thead>
            <tbody>
              {opening > 0 && (
                <tr style={{ background: 'var(--panel-2)' }}>
                  <td colSpan={3} style={{ color: 'var(--ink-3)' }}>Brought forward, before the books open</td>
                  <td className="num">{fmtQty(opening)}</td>
                  <td colSpan={3} className="num" style={{ color: 'var(--ink-3)' }}>no cost in the books</td>
                  <td className="num">{fmtQty(opening)}</td>
                  <td className="num">—</td>
                  <td className="num">—</td>
                </tr>
              )}
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap">{fmtDate(t.trade_date)}</td>
                  <td><Badge tone={t.type === 'BUY' ? 'accent' : 'pos'}>{t.type}</Badge></td>
                  <td style={{ color: 'var(--ink-3)' }}>{t.voucher ?? '—'}</td>
                  <td className="num">{fmtQty(t.qty)}</td>
                  <td className="num">{fmtPrice(t.price)}</td>
                  <td className="num"><Money value={t.commission} dashZero /></td>
                  <td className="num"><Money value={t.amount} colour /></td>
                  <td className="num">{fmtQty(t.runningQty)}</td>
                  <td className="num"><Money value={t.runningCost} /></td>
                  <td className="num">{fmtPrice(t.avgCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {disposals.length > 0 && (
        <Panel title="Disposals" subtitle="What each sale realised, measured against weighted average cost" flush>
          <div className="overflow-x-auto">
            <table className="book">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="num">Units sold</th>
                  <th className="num">Of which pre-2026</th>
                  <th className="num">Proceeds</th>
                  <th className="num">Cost relieved</th>
                  <th className="num">Gain</th>
                </tr>
              </thead>
              <tbody>
                {disposals.map((d) => (
                  <tr key={d.txnId}>
                    <td className="whitespace-nowrap">{fmtDate(d.date)}</td>
                    <td className="num">{fmtQty(d.qty)}</td>
                    <td className="num">{d.qtyFromOpening ? fmtQty(d.qtyFromOpening) : '—'}</td>
                    <td className="num"><Money value={d.proceedsNet + d.proceedsOpening} /></td>
                    <td className="num"><Money value={d.costRelieved} dashZero /></td>
                    <td className="num">
                      {d.qtyCosted > 0 ? <Money value={d.gainNet} colour signed /> : <span style={{ color: 'var(--ink-3)' }}>no gain booked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5}>Realised on this symbol</td>
                  <td className="num"><Money value={realised} colour signed /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      )}
    </>
  );
}
