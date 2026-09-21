import Link from 'next/link';
import { Money } from '@/components/money';
import { Badge, Check, Empty, Panel, Stat } from '@/components/ui';
import { fmtDate, fmtMonth, fmtPct, fmtPrice, fmtQty, pkr, r2 } from '@/lib/money';
import { sectorOf } from '@/lib/engine/planner';
import type { View } from '@/lib/data/view';

export function KeyFigures({ v }: { v: View }) {
  const unreal = v.book.unrealisedTotal;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Cash at broker" value={<Money value={v.cash} />} sub={`Proved to the statement at ${fmtDate(v.reportingDate)}`} />
      <Stat label="Holdings at cost" value={<Money value={v.book.costTotal} />} sub={`${v.book.holdings.length} symbols`} />
      <Stat
        label="Unrealised gain or loss"
        value={<Money value={unreal} signed />}
        tone={unreal >= 0 ? 'pos' : 'neg'}
        sub={v.book.costTotal ? fmtPct((unreal / v.book.costTotal) * 100) + ' on cost' : undefined}
      />
      <Stat label="Portfolio value" value={<Money value={v.equity} />} sub="Cash plus holdings at market" />
    </div>
  );
}

export function EquityAgainstFunds({ v }: { v: View }) {
  const gain = v.gainOnFunds;
  const pct = v.fundsIntroduced ? (gain / v.fundsIntroduced) * 100 : null;
  return (
    <Panel
      title="Portfolio equity against funds introduced"
      subtitle="What the book is worth, next to what the owner has put into it"
    >
      <table className="book">
        <tbody>
          <tr>
            <td>Opening balance brought forward</td>
            <td className="num"><Money value={v.statements.openingCash} /></td>
          </tr>
          <tr>
            <td>Deposits into the broker account</td>
            <td className="num"><Money value={v.statements.contributions} /></td>
          </tr>
          <tr>
            <td className="rule-top font-semibold">Funds introduced</td>
            <td className="num rule-top font-semibold"><Money value={v.fundsIntroduced} /></td>
          </tr>
          <tr>
            <td>Cash at broker</td>
            <td className="num"><Money value={v.cash} /></td>
          </tr>
          <tr>
            <td>Holdings at market</td>
            <td className="num"><Money value={v.book.marketValueTotal} /></td>
          </tr>
          <tr>
            <td>Dividends banked outside the broker</td>
            <td className="num"><Money value={v.income.dividendNet} /></td>
          </tr>
          <tr>
            <td className="rule-top font-semibold">Portfolio equity</td>
            <td className="num rule-top font-semibold"><Money value={r2(v.equity + v.income.dividendNet)} /></td>
          </tr>
          <tr>
            <td className="rule-double font-semibold">Gain against funds introduced</td>
            <td className="num rule-double font-semibold" style={{ color: gain >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
              <Money value={gain} signed /> {pct != null && <span className="text-xs font-normal">({fmtPct(pct)})</span>}
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

export function Allocation({ v }: { v: View }) {
  const total = v.book.marketValueTotal;
  const bySector = new Map<string, number>();
  for (const h of v.book.holdings) {
    const s = sectorOf(h.symbol, v.data.settings) ?? 'Unclassified';
    bySector.set(s, r2((bySector.get(s) ?? 0) + (h.marketValue ?? 0)));
  }
  const sectors = [...bySector.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <Panel title="Allocation" subtitle="By holding, and by sector" flush>
      <div className="overflow-x-auto">
        <table className="book">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Sector</th>
              <th className="num">Quantity</th>
              <th className="num">Last</th>
              <th className="num">Market value</th>
              <th className="num">Weight</th>
            </tr>
          </thead>
          <tbody>
            {v.book.holdings.map((h) => (
              <tr key={h.symbol}>
                <td className="font-medium">
                  <Link href={`/holdings/${h.symbol}`} className="underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>
                    {h.symbol}
                  </Link>
                </td>
                <td style={{ color: 'var(--ink-3)' }}>{sectorOf(h.symbol, v.data.settings) ?? '—'}</td>
                <td className="num">{fmtQty(h.qty)}</td>
                <td className="num">{fmtPrice(h.close)}</td>
                <td className="num"><Money value={h.marketValue} /></td>
                <td className="num">{total ? fmtPct(((h.marketValue ?? 0) / total) * 100) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4}>Total</td>
              <td className="num"><Money value={total} /></td>
              <td className="num">100.00%</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
        <div className="text-[11px] uppercase tracking-wider mb-2" style={{ color: 'var(--ink-3)' }}>By sector</div>
        <ul className="space-y-1.5">
          {sectors.map(([s, val]) => {
            const pct = total ? (val / total) * 100 : 0;
            return (
              <li key={s}>
                <div className="flex items-baseline justify-between gap-3 text-[13px]">
                  <span className="truncate">{s}</span>
                  <span className="num shrink-0" style={{ color: 'var(--ink-2)' }}>
                    <Money value={val} decimals={0} /> · {fmtPct(pct)}
                  </span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded" style={{ background: 'var(--line)' }}>
                  <div className="h-full rounded" style={{ width: `${Math.min(pct, 100)}%`, background: 'var(--accent)' }} />
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Panel>
  );
}

export function LatestEntries({ v }: { v: View }) {
  const rows = v.ledger.slice(-12).reverse();
  return (
    <Panel
      title="Latest entries"
      subtitle="The most recent twelve rows of the cash book"
      actions={<Link href="/ledger" className="text-[13px] underline underline-offset-2">Open the ledger</Link>}
      flush
    >
      <div className="overflow-x-auto">
        <table className="book">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Detail</th>
              <th className="num">Amount</th>
              <th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td className="whitespace-nowrap">{fmtDate(t.trade_date)}</td>
                <td><Badge tone={t.type === 'BUY' ? 'accent' : t.type === 'SELL' ? 'pos' : 'plain'}>{t.type}</Badge></td>
                <td className="max-w-[22rem] truncate" style={{ color: 'var(--ink-2)' }}>
                  {t.symbol ? `${t.symbol} ${fmtQty(t.qty)} at ${fmtPrice(t.price)}` : t.note || '—'}
                  {t.external && <span className="ml-1.5"><Badge tone="warn">outside broker</Badge></span>}
                </td>
                <td className="num"><Money value={t.amount} colour /></td>
                <td className="num" style={{ color: 'var(--ink-3)' }}>
                  {t.running == null ? '—' : <Money value={t.running} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function ProofPanel({ v }: { v: View }) {
  const p = v.proof;
  return (
    <Panel title="Control" subtitle="The checks that have to hold before any figure here is worth reading">
      <Check
        ok={p.mismatches.length === 0}
        label={`Cash proved line by line against the broker balance`}
        detail={`${p.checked} rows carry a broker balance; ${p.mismatches.length} disagree`}
      />
      <Check ok={p.reconciled} label="Statement control totals agree" detail={`Closing ${pkr(p.closing)}`} />
      <Check
        ok={v.book.fullyPriced}
        label="Every holding is marked to a stored price"
        detail={v.pricedAt ? `Latest price stored at ${fmtDate(v.pricedAt)}` : 'No prices stored'}
      />
      <Check ok={v.statements.balanced} label="Financial statements balance" detail={<Link href="/statements" className="underline underline-offset-2">Open the statements</Link>} />
    </Panel>
  );
}

export function IncomePanel({ v }: { v: View }) {
  const i = v.income;
  return (
    <Panel title="Income and tax" subtitle="Since the books opened">
      <table className="book">
        <tbody>
          <tr><td>Realised gains on disposal</td><td className="num"><Money value={i.realised} colour /></td></tr>
          <tr><td>Unrealised on holdings</td><td className="num"><Money value={i.unrealised} colour /></td></tr>
          <tr><td>Dividends, gross of tax</td><td className="num"><Money value={i.dividendGross} /></td></tr>
          <tr><td>Markup on cash</td><td className="num"><Money value={i.markup} /></td></tr>
          <tr>
            <td className="rule-top font-semibold">Total return before tax and costs</td>
            <td className="num rule-top font-semibold"><Money value={i.totalReturn} colour signed /></td>
          </tr>
          <tr><td>Cost of trading</td><td className="num"><Money value={-i.tradingCosts} colour /></td></tr>
          <tr><td>Withholding tax on dividends</td><td className="num"><Money value={-i.dividendTax} colour /></td></tr>
          <tr><td>Capital gains tax billed</td><td className="num"><Money value={-i.cgtBilled} colour /></td></tr>
          <tr>
            <td>
              Capital gains tax accrued <Badge tone="warn">estimate</Badge>
            </td>
            <td className="num"><Money value={-i.cgtAccrued} colour /></td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
        NCCPL bills capital gains tax monthly in arrears. The accrual is 15 per cent of gains realised since{' '}
        {v.cgt.lastBilled ? `the ${fmtMonth(v.cgt.lastBilled)} bill` : 'the books opened'} and is an estimate, not a demand.
      </p>
    </Panel>
  );
}

export function MoversPanel({ v }: { v: View }) {
  const movers = v.book.holdings
    .filter((h) => h.unrealisedPct != null)
    .slice()
    .sort((a, b) => (b.unrealisedPct ?? 0) - (a.unrealisedPct ?? 0));
  if (!movers.length) return <Panel title="Positions by return"><Empty>No priced holdings.</Empty></Panel>;
  return (
    <Panel title="Positions by return" subtitle="Unrealised, against weighted average cost" flush>
      <div className="overflow-x-auto">
        <table className="book">
          <thead>
            <tr>
              <th>Symbol</th>
              <th className="num">Average cost</th>
              <th className="num">Last</th>
              <th className="num">Unrealised</th>
              <th className="num">Return</th>
            </tr>
          </thead>
          <tbody>
            {movers.map((h) => (
              <tr key={h.symbol}>
                <td className="font-medium">{h.symbol}</td>
                <td className="num">{fmtPrice(h.avgCost)}</td>
                <td className="num">{fmtPrice(h.close)}</td>
                <td className="num"><Money value={h.unrealised} colour signed /></td>
                <td className="num" style={{ color: (h.unrealisedPct ?? 0) >= 0 ? 'var(--pos)' : 'var(--neg)' }}>
                  {fmtPct(h.unrealisedPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
