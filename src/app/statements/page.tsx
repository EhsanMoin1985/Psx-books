import Link from 'next/link';
import { Money, Unit } from '@/components/money';
import { PrintButton } from '@/components/print-button';
import { StatementTable } from '@/components/statement-table';
import { Check, Note, Panel, PageHeader } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { concentration, deferredTaxPosition, sensitivity } from '@/lib/engine/ifrs';
import { CGT_RATE, DIVIDEND_WHT_RATE, tradingCosts } from '@/lib/engine/reports';
import { sectorOf } from '@/lib/engine/planner';
import { fmtDate, fmtPct, fmtQty, fmtPrice, pkr, r2 } from '@/lib/money';

export const metadata = { title: 'Financial statements' };
export const dynamic = 'force-dynamic';

function NoteBlock({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="note-block print-block mb-5">
      <h3 className="text-[13px] font-semibold mb-1.5">{n}. {title}</h3>
      <div className="space-y-2 text-[13px] leading-relaxed" style={{ color: 'var(--ink-2)' }}>{children}</div>
    </section>
  );
}

export default async function StatementsPage() {
  const v = await loadView();
  const st = v.statements;
  const f = st.figures;
  const conc = concentration(v.book);
  const dt = deferredTaxPosition(v.book);
  const costs = tradingCosts(v.data.transactions);
  const top = conc[0];

  return (
    <>
      <PageHeader
        title="Financial statements"
        lede={`For the period ${fmtDate(st.periodStart)} to ${fmtDate(st.periodEnd)}, prepared under IFRS. Amounts in rupees unless the currency toggle says otherwise.`}
        actions={<PrintButton />}
      />

      <div className="mb-4">
        <Panel title="Balanced and reconciled">
          {st.checks.map((c) => <Check key={c.label} ok={c.ok} label={c.label} detail={c.detail} />)}
          <div className="mt-2 pt-2 border-t" style={{ borderColor: 'var(--line)' }}>
            <Check
              ok={st.balanced}
              label={st.balanced ? 'These statements balance and reconcile to the cash book' : 'These statements do not balance'}
              detail={st.balanced ? 'Every check above passes' : 'Investigate the failed check before relying on any figure here'}
            />
          </div>
        </Panel>
      </div>

      {!st.openingSecuritiesKnown && (
        <div className="mb-4 no-print">
          <Note tone="warn">
            No 31 December 2025 closing price is stored for the holdings carried in from before the books open, so they
            are measured at nil deemed cost: opening equity is the cash brought forward alone, and the whole of their
            disposal proceeds is a gain. Entering prices on the{' '}
            <Link href="/reconcile" className="underline underline-offset-2">reconciliation</Link> moves the split between
            opening equity and that gain. It moves no total, and the statements balance either way.
          </Note>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Statement of financial position" subtitle={`As at ${fmtDate(st.periodEnd)}`}>
          <div className="mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Assets · <Unit /></div>
          <StatementTable lines={st.position.assets} caption="Assets" />
          <div className="mt-4 mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Liabilities</div>
          <StatementTable lines={st.position.liabilities} caption="Liabilities" />
          <div className="mt-4 mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Equity</div>
          <StatementTable lines={st.position.equity} caption="Equity" />
          <div className="mt-3 flex items-baseline justify-between rounded px-3 py-2 text-[13px]" style={{ background: st.balanced ? 'var(--pos-soft)' : 'var(--neg-soft)', color: st.balanced ? 'var(--pos)' : 'var(--neg)' }}>
            <span>Total assets less total liabilities</span>
            <span className="num font-semibold"><Money value={st.position.netAssets} /></span>
          </div>
        </Panel>

        <Panel title="Statement of profit or loss and other comprehensive income" subtitle={`For the period ended ${fmtDate(st.periodEnd)}`}>
          <div className="mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}><Unit /></div>
          <StatementTable lines={st.profitOrLoss} caption="Profit or loss" />
        </Panel>

        <Panel title="Statement of changes in equity" subtitle={`For the period ended ${fmtDate(st.periodEnd)}`}>
          <div className="mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}><Unit /></div>
          <StatementTable lines={st.changesInEquity} caption="Changes in equity" />
        </Panel>

        <Panel title="Statement of cash flows" subtitle="Direct method, for the period ended">
          <div className="mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Operating activities · <Unit /></div>
          <StatementTable lines={st.cashFlows.operating} caption="Operating activities" />
          <div className="mt-4 mb-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>Financing activities</div>
          <StatementTable lines={st.cashFlows.financing} caption="Financing activities" />
          <div className="mt-4">
            <StatementTable
              lines={[
                { label: 'Net increase in cash and cash equivalents', value: st.cashFlows.netChange, total: true },
                { label: `Cash and cash equivalents at ${fmtDate(st.periodStart)}`, value: st.cashFlows.openingCash },
                { label: `Cash and cash equivalents at ${fmtDate(st.periodEnd)}`, value: st.cashFlows.closingCash, total: true, note: 8 },
              ]}
              caption="Movement in cash"
            />
          </div>
        </Panel>
      </div>

      <Panel title="Notes to the financial statements" className="mt-4">
        <div className="md:columns-2 md:gap-8">
          <NoteBlock n={1} title="Basis of preparation">
            <p>
              These statements present the investment activities of a single owner, carried on through account 7808 with
              JS Global Capital Limited on the Pakistan Stock Exchange. They are prepared in accordance with
              International Financial Reporting Standards, on the historical cost basis except for financial assets
              held for trading, which are measured at fair value.
            </p>
            <p>
              The functional and presentation currency is the Pakistan rupee. Where the display is switched to New Zealand
              dollars, every figure is translated at a single stored rate, currently {v.fxRate.toFixed(2)} rupees to the
              dollar at {fmtDate(v.fxAsOf)}. That is a convenience translation and not a measurement basis: the books are
              kept in rupees.
            </p>
            <p>
              The period runs from {fmtDate(st.periodStart)}, the date of the balance brought forward, to{' '}
              {fmtDate(st.periodEnd)}. This is the first period presented, so no comparatives are shown.
            </p>
            <p>
              The owner intends to continue the activity and has the means to do so, so the going concern basis is
              appropriate.
            </p>
          </NoteBlock>

          <NoteBlock n={2} title="Material accounting policies">
            <p>
              <strong>Classification.</strong> The listed securities are acquired principally to be sold in the near
              term, so they are held for trading and measured at fair value through profit or loss under IFRS 9. No
              election has been made to present fair value changes in other comprehensive income; accordingly other
              comprehensive income is nil and total comprehensive income equals profit for the period.
            </p>
            <p>
              <strong>Transaction costs.</strong> Because the assets are at fair value through profit or loss,
              transaction costs are recognised in profit or loss as incurred and are not capitalised into the carrying
              amount. Cost in these statements is therefore the gross consideration, quantity multiplied by trade price.
              Brokerage, capital value tax and exchange levies of{' '}
              <Money value={f.transactionCosts} /> are expensed.
            </p>
            <p>
              <strong>Recognition.</strong> Purchases and sales are recognised on trade date. A financial asset is
              derecognised when the contractual rights to its cash flows expire or are transferred.
            </p>
            <p>
              <strong>Measurement of cost relieved.</strong> On disposal, cost is relieved on a weighted average basis.
              The broker relieves cost on a first in, first out basis; the difference affects only the split between
              realised and unrealised gain and is set out in the{' '}
              <Link href="/reconcile" className="underline underline-offset-2">reconciliation</Link>.
            </p>
            <p>
              <strong>Income.</strong> Dividend income is recognised gross of withholding tax when the right to receive
              payment is established. Markup on cash held with the broker is recognised as it accrues.
            </p>
            <p>
              <strong>Cash and cash equivalents.</strong> Cash comprises the balance held in the broker account, which is
              available on demand. Amounts settled outside that account are not cash of the book; see note 7.
            </p>
          </NoteBlock>

          <NoteBlock n={3} title="Fair value">
            <p>
              All financial assets held are ordinary shares and exchange traded funds quoted on the Pakistan Stock
              Exchange, measured at the quoted closing price in an active market at the reporting date. They are
              accordingly within <strong>Level 1</strong> of the fair value hierarchy. There were no transfers between
              levels during the period, and the book holds no Level 2 or Level 3 instruments.
            </p>
            <table className="book mt-2">
              <thead>
                <tr><th>Symbol</th><th className="num">Quantity</th><th className="num">Quoted price</th><th className="num">Fair value</th></tr>
              </thead>
              <tbody>
                {v.book.holdings.map((h) => (
                  <tr key={h.symbol}>
                    <td>{h.symbol}</td>
                    <td className="num">{fmtQty(h.qty)}</td>
                    <td className="num">{fmtPrice(h.close)}</td>
                    <td className="num"><Money value={h.marketValue} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td colSpan={3}>Level 1 total</td><td className="num"><Money value={f.fairValue} /></td></tr>
              </tfoot>
            </table>
            <p className="mt-2">
              Prices are those stored at {fmtDate(v.pricedAt)}, sourced from{' '}
              {v.data.settings.prices?.source ?? 'the stored price record'}. Cash and the tax payable are carried at
              amounts that approximate fair value because they are short term.
            </p>
          </NoteBlock>

          <NoteBlock n={4} title="Net gains on financial assets at fair value through profit or loss">
            <table className="book">
              <tbody>
                <tr><td>Realised on disposal, measured on gross consideration</td><td className="num"><Money value={f.realisedGross} accounting /></td></tr>
                <tr><td>Change in unrealised fair value of assets still held</td><td className="num"><Money value={f.unrealisedGross} accounting /></td></tr>
                <tr><td>Realised on holdings carried at deemed cost</td><td className="num"><Money value={f.deemedCostDisposalGain} accounting /></td></tr>
                <tr><td className="rule-top font-semibold">Net gain or loss</td><td className="num rule-top font-semibold"><Money value={r2(f.realisedGross + f.unrealisedGross + f.deemedCostDisposalGain)} accounting /></td></tr>
              </tbody>
            </table>
            <p className="mt-2">
              The realised figure differs from the {pkr(v.book.realisedNet)} shown on the{' '}
              <Link href="/reports" className="underline underline-offset-2">reports</Link> because the reports measure
              gains on the net amounts the broker charged, which carry transaction costs inside cost, while these
              statements expense those costs and measure on gross prices. The difference is presentation between two
              lines of the same statement and does not change profit.
            </p>
            <p>
              Equity comprises the cash and securities the owner introduced, being{' '}
              <Money value={r2(st.openingEquity + st.contributions)} />, and earnings retained in the book since.
              {!st.openingSecuritiesKnown && ' Opening equity includes no value for the holdings carried in from before the period, no 31 December 2025 price having been recorded for them.'}
            </p>
          </NoteBlock>

          <NoteBlock n={5} title="Taxation">
            <p>
              <strong>Capital gains tax.</strong> Gains on listed securities are subject to capital gains tax at the
              filer rate of {(CGT_RATE * 100).toFixed(0)} per cent. The tax is computed and collected monthly in arrears
              by the National Clearing Company of Pakistan Limited, which withholds it from the broker account.
            </p>
            <table className="book">
              <tbody>
                <tr><td>Billed by NCCPL and settled in the period</td><td className="num"><Money value={f.cgtBilled} accounting /></td></tr>
                <tr><td>Accrued on gains realised since the last bill</td><td className="num"><Money value={f.cgtAccrued} accounting /></td></tr>
                <tr><td>Withholding tax on dividends at {(DIVIDEND_WHT_RATE * 100).toFixed(0)} per cent</td><td className="num"><Money value={f.whtOnDividends} accounting /></td></tr>
                <tr><td className="rule-top font-semibold">Tax expense for the period</td><td className="num rule-top font-semibold"><Money value={f.taxTotal} accounting /></td></tr>
              </tbody>
            </table>
            <p className="mt-2">
              The accrual of <Money value={f.cgtAccrued} /> is the owner&apos;s estimate at the statutory rate on gains of{' '}
              <Money value={v.cgt.accruedGain} /> realised since the{' '}
              {v.cgt.lastBilled ? fmtDate(v.cgt.months.find((m) => m.month === v.cgt.lastBilled)?.billedOn ?? st.periodEnd) : 'opening'}{' '}
              bill. NCCPL computes the charge on its own first in, first out matching across all of the holder&apos;s
              accounts and nets losses against gains, so the amount finally billed has differed from the statutory rate
              on the book&apos;s own figures{v.cgt.effectiveRateToDate != null ? `, averaging ${fmtPct(v.cgt.effectiveRateToDate)} of the gain to date` : ''}. The
              liability is measured at the amount expected to be paid.
            </p>
            <p>
              <strong>Deferred tax.</strong> At the reporting date the holdings carry net unrealised losses of{' '}
              <Money value={Math.abs(v.book.unrealisedTotal)} />, being unrealised gains of <Money value={dt.gains} /> and
              unrealised losses of <Money value={dt.losses} />. A deferred tax asset of{' '}
              <Money value={dt.unrecognisedDeferredTaxAsset} /> would arise on those losses.{' '}
              <strong>It is not recognised.</strong> Capital losses on listed securities can be set only against capital
              gains of the same kind, and the owner cannot demonstrate that sufficient future gains will arise against
              which the losses could be used. The deferred tax liability of{' '}
              <Money value={dt.deferredTaxLiability} /> on unrealised gains is likewise not recognised, being immaterial
              and offset by the unrecognised asset.
            </p>
            <p>
              The owner is an individual resident in New Zealand. Any New Zealand tax consequence of this activity is a
              matter of the owner&apos;s personal return and is outside these statements.
            </p>
          </NoteBlock>

          <NoteBlock n={6} title="Financial risk management and concentration">
            <p>
              <strong>Market price risk.</strong> The book is exposed to movements in the quoted prices of its holdings.
              A uniform {fmtPct(10, 0)} rise in every holding&apos;s price at the reporting date would increase profit and
              equity by <Money value={sensitivity(v.book, 10)} />; a fall of the same size would reduce them by the same
              amount, all other variables held constant.
            </p>
            <p>
              <strong>Concentration.</strong> The portfolio is concentrated by design.
              {top && (
                <> The largest holding, {top.symbol}, is {fmtPct(top.pct)} of fair value, and the largest sector,{' '}
                  {(() => {
                    const bySector = new Map<string, number>();
                    for (const h of v.book.holdings) {
                      const s = sectorOf(h.symbol, v.data.settings) ?? 'Unclassified';
                      bySector.set(s, (bySector.get(s) ?? 0) + (h.marketValue ?? 0));
                    }
                    const [name, val] = [...bySector.entries()].sort((a, b) => b[1] - a[1])[0];
                    return `${name}, is ${fmtPct((val / f.fairValue) * 100)}`;
                  })()}
                  . All holdings are quoted on a single exchange in a single country and currency, so the book carries
                  the political, economic and regulatory risk of that market without diversification.</>
              )}
            </p>
            <table className="book mt-2">
              <thead><tr><th>Symbol</th><th className="num">Fair value</th><th className="num">Share</th></tr></thead>
              <tbody>
                {conc.map((c) => (
                  <tr key={c.symbol}>
                    <td>{c.symbol}</td>
                    <td className="num"><Money value={c.value} /></td>
                    <td className="num">{fmtPct(c.pct)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td>Total</td><td className="num"><Money value={f.fairValue} /></td><td className="num">100.00%</td></tr></tfoot>
            </table>
            <p className="mt-2">
              <strong>Liquidity risk.</strong> All holdings are quoted and ordinarily realisable within the exchange&apos;s
              two day settlement cycle, and cash of <Money value={st.cashFlows.closingCash} /> is held on demand. The only
              liability is the tax accrual in note 5, payable within a month.
            </p>
            <p>
              <strong>Credit risk.</strong> Cash and securities are held with a single broker, JS Global Capital Limited,
              a Pakistan Stock Exchange member, with securities held in the owner&apos;s sub-account at the Central
              Depository Company. The maximum exposure to credit risk is the carrying amount of cash,{' '}
              <Money value={st.cashFlows.closingCash} />. No amount is past due or impaired.
            </p>
            <p>
              <strong>Currency risk.</strong> The book is wholly in rupees, so it carries no currency risk in its own
              functional currency. The owner, who is resident in New Zealand, bears the rupee-dollar exposure personally;
              that exposure is outside these statements.
            </p>
          </NoteBlock>

          <NoteBlock n={7} title="Other disclosures">
            <p>
              <strong>Non-cash transactions.</strong> Dividends of <Money value={f.dividendIncome} /> gross,{' '}
              <Money value={v.income.dividendNet} /> net of withholding tax, were paid directly to the owner&apos;s own
              bank account rather than to the broker account. They are income of the book and are included in profit, but
              they never became cash of the book, so they are excluded from the statement of cash flows and shown in the
              statement of changes in equity as a distribution to the owner. This is the only non-cash transaction in the
              period.
            </p>
            <p>
              <strong>Related parties.</strong> The book has one owner, who is also its only source of capital. Amounts
              introduced and distributed in the period are shown in the statement of changes in equity. There are no
              other related party transactions and no key management compensation.
            </p>
            <p>
              <strong>Cost of trading.</strong> Total dealing costs for the period were{' '}
              <Money value={costs.total} />, being commission of <Money value={costs.commission} />, capital value tax and
              exchange levies of <Money value={costs.levies} />, and custody, registration and tariff charges of{' '}
              <Money value={costs.fees} />, on turnover of <Money value={costs.turnover} /> across {costs.trades} trades,
              or {fmtPct(costs.pctOfTurnover)} of turnover.
            </p>
            <p>
              <strong>Holdings carried in.</strong>{' '}
              {Object.keys(v.book.opening).length === 0
                ? 'Every disposal in the period has a matching purchase in the records.'
                : `${Object.entries(v.book.opening).map(([s, q]) => `${fmtQty(q)} ${s}`).join(', ')} were held at the start of the period and disposed of during it. ${
                    st.openingSecuritiesKnown
                      ? 'They are measured at their 31 December 2025 closing price as deemed cost.'
                      : 'No acquisition cost is available for them, so they are measured at nil deemed cost and the whole of their proceeds is recognised as a gain. Recording their 31 December 2025 closing price would reallocate that amount to opening equity without changing net assets.'
                  }`}
            </p>
            <p>
              <strong>Capital management.</strong> The owner manages capital to keep enough cash at the broker to settle
              trades and the monthly tax charge, and does not use borrowings or margin. No externally imposed capital
              requirement applies.
            </p>
          </NoteBlock>

          <NoteBlock n={8} title="Events after the reporting period">
            <p>
              These statements are drawn up at {fmtDate(st.periodEnd)}, the date of the latest broker statement and
              quoted prices on the record. Quoted prices move daily and the fair value of the holdings will have changed
              since. Such a change is a non-adjusting event: it reflects conditions arising after the reporting date and
              does not alter the amounts recognised here.
            </p>
            <p>
              The capital gains tax accrued in note 5 is expected to be billed by NCCPL and withheld from the broker
              account in the ordinary monthly cycle following the reporting date.
            </p>
            <p>
              No other event has occurred between the reporting date and the date these statements were prepared that
              requires adjustment of, or disclosure in, the amounts reported.
            </p>
          </NoteBlock>
        </div>
      </Panel>

      <p className="mt-4 text-xs no-print" style={{ color: 'var(--ink-3)' }}>
        These statements are prepared by the owner for the owner&apos;s own use. They are not audited and no assurance is
        expressed on them.
      </p>
    </>
  );
}
