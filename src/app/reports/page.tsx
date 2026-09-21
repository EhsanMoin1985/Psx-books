import Link from 'next/link';
import { Money } from '@/components/money';
import { Badge, Note, Panel, PageHeader, Stat } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { fmtDate, fmtMonth, fmtPct, fmtQty, pkr, r2 } from '@/lib/money';
import { realisedByMonth, realisedBySymbol, tradingCosts, dividends, CGT_RATE } from '@/lib/engine/reports';

export const metadata = { title: 'Reports' };
export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const v = await loadView();
  const bySymbol = realisedBySymbol(v.book.disposals);
  const byMonth = realisedByMonth(v.book.disposals);
  const costs = tradingCosts(v.data.transactions);
  const divs = dividends(v.data.transactions);
  const cgt = v.cgt;

  const maxGain = Math.max(1, ...byMonth.map((m) => Math.abs(m.gain)));

  return (
    <>
      <PageHeader
        title="Reports"
        lede="Realised gains, the tax on them, and what trading has cost. All on the books basis: weighted average cost on the net amounts the broker charged."
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Realised gains" value={<Money value={v.book.realisedNet} signed />} tone={v.book.realisedNet >= 0 ? 'pos' : 'neg'} sub={`${v.book.disposals.length} disposals`} />
        <Stat label="Capital gains tax billed" value={<Money value={cgt.billedTotal} />} sub={cgt.effectiveRateToDate != null ? `${fmtPct(cgt.effectiveRateToDate)} of the gains billed` : undefined} />
        <Stat label="Tax accrued, not yet billed" value={<Money value={cgt.accrued} />} tone="warn" sub={`On ${pkr(cgt.accruedGain, 0)} realised since ${cgt.lastBilled ? fmtMonth(cgt.lastBilled) : 'the start'}`} />
        <Stat label="Cost of trading" value={<Money value={costs.total} />} sub={`${fmtPct(costs.pctOfTurnover)} of turnover`} />
      </div>

      <Panel title="Realised gains by symbol" flush className="mb-4">
        <div className="overflow-x-auto">
          <table className="book">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Disposals</th>
                <th className="num">Units</th>
                <th className="num">Proceeds</th>
                <th className="num">Cost relieved</th>
                <th className="num">Gain</th>
                <th className="num">Return</th>
                <th className="num">Proceeds with no cost</th>
              </tr>
            </thead>
            <tbody>
              {bySymbol.map((g) => (
                <tr key={g.symbol}>
                  <td className="font-medium">
                    <Link href={`/holdings/${g.symbol}`} className="underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>{g.symbol}</Link>
                  </td>
                  <td className="num">{g.trades}</td>
                  <td className="num">{fmtQty(g.qty)}</td>
                  <td className="num"><Money value={g.proceeds} dashZero /></td>
                  <td className="num"><Money value={g.cost} dashZero /></td>
                  <td className="num"><Money value={g.gain} colour signed dashZero /></td>
                  <td className="num" style={{ color: (g.gainPct ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>{fmtPct(g.gainPct)}</td>
                  <td className="num" style={{ color: 'var(--ink-3)' }}><Money value={g.proceedsNoCost} dashZero /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="num"><Money value={bySymbol.reduce((a, g) => r2(a + g.proceeds), 0)} /></td>
                <td className="num"><Money value={bySymbol.reduce((a, g) => r2(a + g.cost), 0)} /></td>
                <td className="num"><Money value={v.book.realisedNet} colour signed /></td>
                <td />
                <td className="num"><Money value={v.book.proceedsNoCost} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <Note>
            The last column is proceeds on units held before the books open. No gain is booked on them, because the data
            carries no purchase to measure against. The{' '}
            <Link href="/reconcile" className="underline underline-offset-2">reconciliation</Link> lists them and takes a
            31 December 2025 price if you want a deemed cost.
          </Note>
        </div>
      </Panel>

      <Panel title="Realised gains by month" flush className="mb-4">
        <div className="overflow-x-auto">
          <table className="book">
            <thead>
              <tr>
                <th>Month</th>
                <th className="num">Disposals</th>
                <th className="num">Proceeds</th>
                <th className="num">Cost relieved</th>
                <th className="num">Gain</th>
                <th style={{ width: '32%' }}>Relative size</th>
              </tr>
            </thead>
            <tbody>
              {byMonth.map((m) => (
                <tr key={m.month}>
                  <td className="whitespace-nowrap">{fmtMonth(m.month)}</td>
                  <td className="num">{m.trades}</td>
                  <td className="num"><Money value={m.proceeds} /></td>
                  <td className="num"><Money value={m.cost} /></td>
                  <td className="num"><Money value={m.gain} colour signed /></td>
                  <td>
                    <div className="h-2 w-full rounded" style={{ background: 'var(--line)' }}>
                      <div
                        className="h-full rounded"
                        style={{
                          width: `${(Math.abs(m.gain) / maxGain) * 100}%`,
                          background: m.gain >= 0 ? 'var(--pos)' : 'var(--neg)',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td className="num"><Money value={v.book.realisedNet} colour signed /></td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <Panel
        title="Capital gains tax by month"
        subtitle="NCCPL bills monthly in arrears, so a charge in the cash book belongs to an earlier month"
        flush
        className="mb-4"
      >
        <div className="overflow-x-auto">
          <table className="book">
            <thead>
              <tr>
                <th>Month realised</th>
                <th className="num">Gain</th>
                <th className="num">Tax at {(CGT_RATE * 100).toFixed(0)}%</th>
                <th className="num">Billed by NCCPL</th>
                <th className="num">Effective rate</th>
                <th>Billed on</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cgt.months.map((m) => (
                <tr key={m.month}>
                  <td className="whitespace-nowrap">{fmtMonth(m.month)}</td>
                  <td className="num"><Money value={m.gain} colour signed /></td>
                  <td className="num" style={{ color: 'var(--ink-3)' }}><Money value={m.expected} dashZero /></td>
                  <td className="num">{m.billed == null ? <span style={{ color: 'var(--ink-3)' }}>—</span> : <Money value={m.billed} />}</td>
                  <td className="num">{fmtPct(m.effectiveRate)}</td>
                  <td>{m.billedOn ? fmtDate(m.billedOn) : '—'}</td>
                  <td>
                    {m.status === 'billed' ? <Badge tone="pos">billed</Badge>
                      : m.status === 'accrued' ? <Badge tone="warn">accrued, estimate</Badge>
                      : <Badge tone="plain">not charged</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td className="num"><Money value={v.book.realisedNet} colour signed /></td>
                <td className="num"><Money value={cgt.months.reduce((a, m) => r2(a + m.expected), 0)} /></td>
                <td className="num"><Money value={cgt.billedTotal} /></td>
                <td className="num">{fmtPct(cgt.effectiveRateToDate)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t p-4 space-y-2" style={{ borderColor: 'var(--line)' }}>
          <Note tone="warn">
            <p className="font-medium" style={{ color: 'var(--ink)' }}>
              Expected tax on gains not yet billed: {pkr(cgt.accrued)}
            </p>
            <p className="mt-1">
              Fifteen per cent of the {pkr(cgt.accruedGain)} realised
              since the {cgt.lastBilled ? fmtMonth(cgt.lastBilled) : 'opening'} bill. This is the book&apos;s own estimate,
              not a demand from NCCPL.
            </p>
          </Note>
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
            NCCPL charges less than fifteen per cent of the book&apos;s gain in most months because it works out the gain
            itself, on its own first in, first out matching and across all of the holder&apos;s accounts, netting losses
            against gains. Months marked <em>not charged</em> fall on or before the last billed month and were never
            charged, so no accrual is raised on them.
          </p>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Cost of trading" subtitle={`${costs.trades} trades, turnover ${pkr(costs.turnover)}`}>
          <table className="book">
            <tbody>
              <tr><td>Brokerage commission</td><td className="num"><Money value={costs.commission} /></td></tr>
              <tr><td>CVT and exchange levies</td><td className="num"><Money value={costs.levies} /></td></tr>
              <tr><td>Custody, UIN and tariff charges</td><td className="num"><Money value={costs.fees} /></td></tr>
              <tr>
                <td className="rule-top font-semibold">Total cost of trading</td>
                <td className="num rule-top font-semibold"><Money value={costs.total} /></td>
              </tr>
              <tr>
                <td style={{ color: 'var(--ink-3)' }}>As a share of turnover</td>
                <td className="num" style={{ color: 'var(--ink-3)' }}>{fmtPct(costs.pctOfTurnover)}</td>
              </tr>
              <tr>
                <td style={{ color: 'var(--ink-3)' }}>Against realised gains</td>
                <td className="num" style={{ color: 'var(--ink-3)' }}>
                  {fmtPct(v.book.realisedNet ? (costs.total / v.book.realisedNet) * 100 : null)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
            Commission and levies are already inside the net amount on every trade, so they are in cost on the books basis.
            The <Link href="/statements" className="underline underline-offset-2">financial statements</Link> expense them
            instead, as IFRS 9 requires for assets at fair value through profit or loss.
          </p>
        </Panel>

        <Panel title="Dividends" subtitle="Recorded gross, with withholding tax at the filer rate as tax expense">
          <table className="book">
            <thead>
              <tr>
                <th>Date</th>
                <th>Detail</th>
                <th className="num">Gross</th>
                <th className="num">Tax</th>
                <th className="num">Net</th>
              </tr>
            </thead>
            <tbody>
              {divs.map((d) => (
                <tr key={d.id}>
                  <td className="whitespace-nowrap">{fmtDate(d.date)}</td>
                  <td className="max-w-[16rem] truncate" style={{ color: 'var(--ink-2)' }}>
                    {d.note}
                    {d.external && <span className="ml-1"><Badge tone="warn">outside broker</Badge></span>}
                  </td>
                  <td className="num"><Money value={d.gross} /></td>
                  <td className="num"><Money value={d.tax} /></td>
                  <td className="num"><Money value={d.net} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={2}>Total</td>
                <td className="num"><Money value={v.income.dividendGross} /></td>
                <td className="num"><Money value={v.income.dividendTax} /></td>
                <td className="num"><Money value={v.income.dividendNet} /></td>
              </tr>
            </tfoot>
          </table>
          <p className="mt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
            Both dividends were paid into the owner&apos;s own bank rather than the broker account. They are income of the
            book and part of total return, but they are not broker cash and do not appear in the cash flow statement.
          </p>
        </Panel>
      </div>
    </>
  );
}
