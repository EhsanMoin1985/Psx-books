import Link from 'next/link';
import { Money } from '@/components/money';
import { Badge, Empty, Note, Panel, PageHeader } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { fmtDate, fmtPct, fmtPrice, fmtQty } from '@/lib/money';

export const metadata = { title: 'Holdings' };
export const dynamic = 'force-dynamic';

export default async function HoldingsPage() {
  const v = await loadView();
  const b = v.book;

  return (
    <>
      <PageHeader
        title="Holdings"
        lede="Weighted average cost on the net amounts the broker charged, marked to the latest stored price. Open a symbol to see every trade behind it."
      />

      <Panel
        title="Open positions"
        subtitle={`${b.holdings.length} symbols, priced at ${fmtDate(v.pricedAt)}`}
        flush
        className="mb-4"
      >
        <div className="overflow-x-auto">
          <table className="book">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Quantity</th>
                <th className="num">Average cost</th>
                <th className="num">Book cost</th>
                <th className="num">Last price</th>
                <th className="num">Market value</th>
                <th className="num">Unrealised</th>
                <th className="num">Return</th>
              </tr>
            </thead>
            <tbody>
              {b.holdings.map((h) => (
                <tr key={h.symbol}>
                  <td className="font-medium">
                    <Link href={`/holdings/${h.symbol}`} className="underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>
                      {h.symbol}
                    </Link>
                    {h.openingQty > 0 && <span className="ml-1.5"><Badge tone="warn">{fmtQty(h.openingQty)} pre-2026</Badge></span>}
                  </td>
                  <td className="num">{fmtQty(h.qty)}</td>
                  <td className="num">{fmtPrice(h.avgCost)}</td>
                  <td className="num"><Money value={h.totalCost ?? h.cost} /></td>
                  <td className="num">{fmtPrice(h.close)}</td>
                  <td className="num"><Money value={h.marketValue} /></td>
                  <td className="num"><Money value={h.unrealised} colour signed /></td>
                  <td className="num" style={{ color: (h.unrealisedPct ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                    {fmtPct(h.unrealisedPct)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num">{fmtQty(b.holdings.reduce((a, h) => a + h.qty, 0))}</td>
                <td />
                <td className="num"><Money value={b.costTotal} /></td>
                <td />
                <td className="num"><Money value={b.marketValueTotal} /></td>
                <td className="num"><Money value={b.unrealisedTotal} colour signed /></td>
                <td className="num" style={{ color: b.unrealisedTotal >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {fmtPct(b.costTotal ? (b.unrealisedTotal / b.costTotal) * 100 : null)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel title="Closed positions" subtitle="Symbols the book no longer holds, with the gain realised on them" flush>
        {b.closed.length === 0 ? (
          <Empty>Nothing closed yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="book">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Realised gain</th>
                  <th className="num">Proceeds with no cost</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {b.closed.map((h) => (
                  <tr key={h.symbol}>
                    <td className="font-medium">
                      <Link href={`/holdings/${h.symbol}`} className="underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>
                        {h.symbol}
                      </Link>
                    </td>
                    <td className="num"><Money value={h.realised} colour signed /></td>
                    <td className="num"><Money value={h.proceedsNoCost} dashZero /></td>
                    <td style={{ color: 'var(--ink-3)' }}>
                      {h.proceedsNoCost ? 'Held before the books open; proceeds booked, no gain' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <Note>
            Cost is the weighted average of the net amounts charged, so brokerage, CVT and the exchange levies sit in
            cost. JS relieves cost on first in, first out, which is why the two differ. The{' '}
            <Link href="/reconcile" className="underline underline-offset-2">reconciliation</Link> sets the difference out
            symbol by symbol.
          </Note>
        </div>
      </Panel>
    </>
  );
}
