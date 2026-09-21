import Link from 'next/link';
import { Money } from '@/components/money';
import { OpeningPriceForm } from '@/components/opening-price-form';
import { Badge, Check, Note, Panel, PageHeader, Stat } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { fmtDate, fmtPrice, fmtQty, pkr, r2 } from '@/lib/money';

export const metadata = { title: 'Reconcile' };
export const dynamic = 'force-dynamic';

/** JS reports an average rate to two decimals, so its cost carries that rounding. */
const jsRounding = (cost: number, qty: number) => r2(r2(Math.round((cost / qty) * 100) / 100) * qty);

export default async function ReconcilePage() {
  const v = await loadView();
  const p = v.proof;
  const brokerQty = v.data.settings.broker?.qty ?? {};
  const brokerCost = v.data.settings.broker?.cost ?? {};
  const openingPx = v.data.settings.openingPrices ?? {};

  const rows = v.book.holdings.map((h) => {
    const jsQty = brokerQty[h.symbol] ?? 0;
    const jsCost = brokerCost[h.symbol] ?? 0;
    const rounded = jsRounding(h.cost, h.qty);
    return {
      h,
      jsQty,
      jsCost,
      qtyDiff: r2(h.qty - jsQty),
      costDiff: r2(h.cost - jsCost),
      // The part explained purely by JS rounding its average rate to 2dp.
      roundingDiff: r2(h.cost - rounded),
      // What is left is a real difference in how cost is relieved.
      methodDiff: r2(rounded - jsCost),
    };
  });

  const totals = rows.reduce(
    (a, r) => ({
      cost: r2(a.cost + r.h.cost),
      jsCost: r2(a.jsCost + r.jsCost),
      rounding: r2(a.rounding + r.roundingDiff),
      method: r2(a.method + r.methodDiff),
    }),
    { cost: 0, jsCost: 0, rounding: 0, method: 0 },
  );

  const qtyMismatches = rows.filter((r) => r.qtyDiff !== 0);
  const preBooks = Object.entries(v.book.opening);

  return (
    <>
      <PageHeader
        title="Reconciliation"
        lede={`The book against the JS Global statement and portfolio at ${fmtDate(v.data.settings.broker?.asOf ?? v.reportingDate)}. Differences are set out, not smoothed over.`}
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Cash" value={p.reconciled ? 'Agrees' : 'Check'} tone={p.reconciled ? 'pos' : 'neg'} sub={`Closing ${pkr(p.closing)}`} />
        <Stat label="Quantities" value={qtyMismatches.length ? `${qtyMismatches.length} differ` : 'Agree'} tone={qtyMismatches.length ? 'neg' : 'pos'} sub="Every symbol against JS" />
        <Stat label="Cost against JS" value={<Money value={r2(totals.cost - totals.jsCost)} signed />} tone="warn" sub="Explained in full below" />
        <Stat label="Pre-2026 holdings" value={String(preBooks.length)} sub={preBooks.length ? 'Need a 31 Dec 2025 price' : 'None'} />
      </div>

      <Panel title="Statement control totals" subtitle={v.data.settings.statement?.period} className="mb-4">
        <table className="book">
          <thead>
            <tr>
              <th>Control</th>
              <th className="num">Per the book</th>
              <th className="num">Per JS</th>
              <th className="num">Difference</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total debits</td>
              <td className="num"><Money value={p.debits} /></td>
              <td className="num"><Money value={p.expected.debits} /></td>
              <td className="num"><Money value={r2(p.debits - (p.expected.debits ?? p.debits))} dashZero /></td>
            </tr>
            <tr>
              <td>Total credits</td>
              <td className="num"><Money value={p.credits} /></td>
              <td className="num"><Money value={p.expected.credits} /></td>
              <td className="num"><Money value={r2(p.credits - (p.expected.credits ?? p.credits))} dashZero /></td>
            </tr>
            <tr>
              <td className="rule-top font-semibold">Closing balance</td>
              <td className="num rule-top font-semibold"><Money value={p.closing} /></td>
              <td className="num rule-top font-semibold"><Money value={p.expected.closing} /></td>
              <td className="num rule-top font-semibold"><Money value={r2(p.closing - (p.expected.closing ?? p.closing))} dashZero /></td>
            </tr>
          </tbody>
        </table>
        <div className="mt-3">
          <Check
            ok={p.mismatches.length === 0}
            label="Every row the broker gave a balance for was reproduced from the opening row forward"
            detail={`${p.checked} rows checked, ${p.mismatches.length} disagree`}
          />
          {p.mismatches.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-[13px]">
              {p.mismatches.map((m) => (
                <li key={m.id} style={{ color: 'var(--neg)' }}>
                  {fmtDate(m.trade_date)} {m.voucher} — book {pkr(m.running)}, broker {pkr(m.stmt_balance)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs" style={{ color: 'var(--ink-3)' }}>
            The two dividends banked outside the broker are excluded from these totals, because the broker statement
            never saw them. They appear in income and in total return.
          </p>
        </div>
      </Panel>

      <Panel
        title="Quantities and cost against JS"
        subtitle="Cost per the books is weighted average on net amounts; JS relieves cost first in, first out"
        flush
        className="mb-4"
      >
        <div className="overflow-x-auto">
          <table className="book">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="num">Book quantity</th>
                <th className="num">JS quantity</th>
                <th className="num">Cost per the books</th>
                <th className="num">Cost per JS</th>
                <th className="num">Difference</th>
                <th className="num">JS rate rounding</th>
                <th className="num">Cost method</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.h.symbol}>
                  <td className="font-medium">
                    <Link href={`/holdings/${r.h.symbol}`} className="underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>{r.h.symbol}</Link>
                  </td>
                  <td className="num">{fmtQty(r.h.qty)}</td>
                  <td className="num">{fmtQty(r.jsQty)}</td>
                  <td className="num"><Money value={r.h.cost} /></td>
                  <td className="num"><Money value={r.jsCost} /></td>
                  <td className="num"><Money value={r.costDiff} dashZero signed /></td>
                  <td className="num" style={{ color: 'var(--ink-3)' }}><Money value={r.roundingDiff} dashZero signed /></td>
                  <td className="num">
                    {r.methodDiff === 0 ? <span style={{ color: 'var(--ink-3)' }}>—</span> : <Money value={r.methodDiff} signed />}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Total</td>
                <td className="num"><Money value={totals.cost} /></td>
                <td className="num"><Money value={totals.jsCost} /></td>
                <td className="num"><Money value={r2(totals.cost - totals.jsCost)} signed /></td>
                <td className="num"><Money value={totals.rounding} signed /></td>
                <td className="num"><Money value={totals.method} signed /></td>
              </tr>
            </tfoot>
          </table>
        </div>
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <Note>
            <p className="font-medium" style={{ color: 'var(--ink)' }}>Why the two differ</p>
            <p className="mt-1">
              <strong>JS rate rounding, {pkr(totals.rounding)}.</strong> JS states an average rate to two decimals
              and multiplies it by the quantity held. The books keep the full rate. This is presentation only and reverses
              on disposal.
            </p>
            <p className="mt-1.5">
              <strong>Cost method, {pkr(totals.method)}.</strong> The books relieve cost on a weighted average;
              JS relieves it first in, first out. The two agree once a position is fully closed, and differ while it is
              open and has been bought at more than one price.
              {rows.some((r) => r.methodDiff !== 0) && (
                <> Here that is {rows.filter((r) => r.methodDiff !== 0).map((r) => `${r.h.symbol} ${pkr(r.methodDiff)}`).join(', ')}.</>
              )}
            </p>
            <p className="mt-1.5">
              Neither difference affects cash, quantities or realised gains. It changes only the cost carried against the
              units still held, and therefore the split between unrealised and realised gain when they are sold.
            </p>
          </Note>
        </div>
      </Panel>

      <Panel
        title="Holdings carried in from before the books open"
        subtitle="Units sold with no matching purchase in the data. Enter their 31 December 2025 closing price to give them a deemed cost."
      >
        {preBooks.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--ink-3)' }}>None. Every disposal has a matching purchase.</p>
        ) : (
          <>
            <table className="book">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="num">Units carried in</th>
                  <th className="num">Proceeds booked</th>
                  <th className="num">Close at 31 Dec 2025</th>
                  <th className="num">Deemed cost</th>
                  <th className="num">Memo gain</th>
                </tr>
              </thead>
              <tbody>
                {preBooks.map(([symbol, qty]) => {
                  const proceeds = v.book.disposals
                    .filter((d) => d.symbol === symbol)
                    .reduce((a, d) => r2(a + d.proceedsOpening), 0);
                  const px = openingPx[symbol] ?? null;
                  const deemed = px != null ? r2(px * qty) : null;
                  return (
                    <tr key={symbol}>
                      <td className="font-medium">
                        <Link href={`/holdings/${symbol}`} className="underline underline-offset-2" style={{ textDecorationColor: 'var(--line-strong)' }}>{symbol}</Link>
                      </td>
                      <td className="num">{fmtQty(qty)}</td>
                      <td className="num"><Money value={proceeds} /></td>
                      <td className="num"><OpeningPriceForm symbol={symbol} value={px} /></td>
                      <td className="num">{deemed == null ? <span style={{ color: 'var(--ink-3)' }}>not set</span> : <Money value={deemed} />}</td>
                      <td className="num">
                        {deemed == null ? <span style={{ color: 'var(--ink-3)' }}>—</span> : <Money value={r2(proceeds - deemed)} colour signed />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-3 space-y-2">
              <Note tone={v.statements.openingSecuritiesKnown ? 'plain' : 'warn'}>
                {v.statements.openingSecuritiesKnown ? (
                  <>All pre-2026 holdings have a 31 December 2025 price, so opening equity includes their deemed cost of{' '}
                    {pkr(v.statements.openingSecurities)} and the financial statements measure the gain on their
                    disposal against it.</>
                ) : (
                  <>No 31 December 2025 price is stored for {preBooks.filter(([s]) => openingPx[s] == null).map(([s]) => s).join(', ')}.
                    Until one is, the books carry those units at no cost: their disposals show proceeds and no gain, and the
                    financial statements show opening equity of cash only with the whole proceeds as a gain. Entering a price
                    moves the split between the two. It never moves cash, net assets or the closing position.</>
                )}
              </Note>
              <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                The memo gain is shown for information. The books follow the rule that a disposal with no matching purchase
                books proceeds and no gain, which is why these do not appear in realised gains on the{' '}
                <Link href="/reports" className="underline underline-offset-2">reports</Link>.
              </p>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
