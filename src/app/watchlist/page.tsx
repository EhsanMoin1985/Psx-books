import { AlertForm, AlertRow, WatchForm, WatchRowActions } from '@/components/watch-forms';
import { Badge, Empty, Note, Panel, PageHeader } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { watchStatus } from '@/lib/engine/alerts';
import { latestPrices } from '@/lib/engine/holdings';
import { fmtDate, fmtPct, fmtPrice, fmtQty } from '@/lib/money';

export const metadata = { title: 'Watchlist and alerts' };
export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const v = await loadView();
  const latest = latestPrices(v.data.prices, v.data.settings);
  const heldQty = Object.fromEntries(v.book.holdings.map((h) => [h.symbol, h.qty]));
  const rows = watchStatus(v.data.watchlist, latest, heldQty);
  const alerts = v.data.alerts.slice().sort((a, b) => a.symbol.localeCompare(b.symbol));
  const mailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);

  return (
    <>
      <PageHeader
        title="Watchlist and alerts"
        lede="Target levels per symbol, and alerts the scheduled job checks after every price refresh."
      />

      <Panel title="Watchlist" subtitle="Where you would buy, and where you would sell" flush className="mb-4">
        {rows.length === 0 ? (
          <Empty>Nothing on the watchlist yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="book">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Held</th>
                  <th className="num">Last</th>
                  <th className="num">Target buy</th>
                  <th className="num">To buy</th>
                  <th className="num">Target sell</th>
                  <th className="num">To sell</th>
                  <th>Note</th>
                  <th className="no-print" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.symbol}>
                    <td className="font-medium">
                      {r.symbol}
                      {r.atBuy && <span className="ml-1.5"><Badge tone="pos">at buy target</Badge></span>}
                      {r.atSell && <span className="ml-1.5"><Badge tone="warn">at sell target</Badge></span>}
                    </td>
                    <td className="num">{r.held ? fmtQty(r.held) : '—'}</td>
                    <td className="num">{fmtPrice(r.close)}</td>
                    <td className="num">{fmtPrice(r.target_buy)}</td>
                    <td className="num" style={{ color: r.atBuy ? 'var(--pos)' : 'var(--ink-3)' }}>{fmtPct(r.toBuy)}</td>
                    <td className="num">{fmtPrice(r.target_sell)}</td>
                    <td className="num" style={{ color: r.atSell ? 'var(--pos)' : 'var(--ink-3)' }}>{fmtPct(r.toSell)}</td>
                    <td className="max-w-[16rem] truncate" style={{ color: 'var(--ink-3)' }}>{r.note ?? '—'}</td>
                    <td className="no-print"><WatchRowActions row={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <WatchForm symbols={v.symbols} />
          <p className="mt-2 text-xs" style={{ color: 'var(--ink-3)' }}>
            The distance columns are how far the last stored price, at {fmtDate(v.pricedAt)}, is from each target.
            Adding a symbol that is already on the list replaces its targets.
          </p>
        </div>
      </Panel>

      <Panel title="Alerts" subtitle="Checked by the scheduled job after each price refresh" flush>
        {alerts.length === 0 ? (
          <Empty>No alerts set.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="book">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Condition</th>
                  <th className="num">Level</th>
                  <th className="num">Last</th>
                  <th>Status</th>
                  <th className="no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((a) => <AlertRow key={a.id} a={a} close={latest[a.symbol]?.close ?? null} />)}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t p-4 space-y-3" style={{ borderColor: 'var(--line)' }}>
          <AlertForm symbols={v.symbols} />
          <Note tone={mailConfigured ? 'plain' : 'warn'}>
            {mailConfigured
              ? 'Alerts email as soon as a refresh finds a level crossed. Each one fires once and then switches itself off, so a price that sits past its level does not email twice.'
              : 'Email is not configured, so a crossed alert will show here but will not be sent. Set RESEND_API_KEY and ALERT_EMAIL_TO to turn email on. An alert still fires once and switches itself off either way.'}
          </Note>
        </div>
      </Panel>
    </>
  );
}
