import { FxForm, PastePricesForm, SectorForm } from '@/components/settings-forms';
import { Badge, Note, Panel, PageHeader } from '@/components/ui';
import { SeedBanner } from '@/components/seed-banner';
import { loadView } from '@/lib/data/view';
import { DEFAULT_SECTORS, deriveTariff } from '@/lib/engine/planner';
import { latestPrices } from '@/lib/engine/holdings';
import { fmtDate, fmtPrice, pkr } from '@/lib/money';
import { pktDate, resolveSource } from '@/lib/prices/source';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const v = await loadView();
  const latest = latestPrices(v.data.prices, v.data.settings);
  const source = resolveSource();
  const unavailable = source.unavailable();
  const tariff = deriveTariff(v.data.transactions);
  const sectors = { ...DEFAULT_SECTORS, ...(v.data.settings.sectors ?? {}) };
  const mailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.ALERT_EMAIL_TO);

  return (
    <>
      <PageHeader title="Settings" lede="Prices, the exchange rate, sectors, and how this installation is wired up." />
      <SeedBanner mode={v.mode} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Store prices" subtitle="The default source is a paste from your own InvestPro portfolio screen">
          <PastePricesForm today={pktDate()} symbols={v.symbols} />
          <div className="mt-4">
            <Note>
              PSX licenses its market data and prohibits redistribution, so this app never reads the exchange portal. A
              licensed vendor feed can be dropped in behind the same interface by setting{' '}
              <code>PRICE_VENDOR_URL</code> and <code>PRICE_VENDOR_KEY</code>; until then the scheduled job uses this
              paste and reports that it had nothing new rather than inventing a price.
            </Note>
          </div>
        </Panel>

        <Panel title="Prices on record" subtitle={`Latest mark per symbol, ${v.data.settings.prices?.source ?? 'stored'}`} flush>
          <table className="book">
            <thead>
              <tr><th>Symbol</th><th className="num">Close</th><th>Priced at</th><th className="num">Rows stored</th></tr>
            </thead>
            <tbody>
              {Object.entries(latest).sort(([a], [b]) => a.localeCompare(b)).map(([s, p]) => (
                <tr key={s}>
                  <td className="font-medium">{s}</td>
                  <td className="num">{fmtPrice(p.close)}</td>
                  <td>{fmtDate(p.asOf)}</td>
                  <td className="num" style={{ color: 'var(--ink-3)' }}>{v.data.prices.filter((x) => x.symbol === s).length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Exchange rate" subtitle="Used only to display figures in dollars. Nothing is stored in dollars.">
          <FxForm fx={v.data.settings.fx} />
        </Panel>

        <Panel title="How this installation is wired up">
          <table className="book">
            <tbody>
              <tr>
                <td>Data store</td>
                <td className="text-right">
                  {v.mode === 'supabase' ? <Badge tone="pos">Supabase</Badge> : <Badge tone="warn">seed file, not persisted</Badge>}
                </td>
              </tr>
              <tr>
                <td>Price source</td>
                <td className="text-right">
                  {unavailable ? <Badge tone="warn">{source.label} — {unavailable}</Badge> : <Badge tone="pos">{source.label}</Badge>}
                </td>
              </tr>
              <tr>
                <td>Alert email</td>
                <td className="text-right">{mailConfigured ? <Badge tone="pos">Resend configured</Badge> : <Badge tone="warn">not configured</Badge>}</td>
              </tr>
              <tr>
                <td>Scheduled refresh</td>
                <td className="text-right text-[12px]" style={{ color: 'var(--ink-2)' }}>Weekdays 09:32 and 15:30 PKT</td>
              </tr>
              <tr>
                <td>Broker tariff in use</td>
                <td className="text-right text-[12px]" style={{ color: 'var(--ink-2)' }}>
                  {tariff.commissionPct}% commission, {tariff.leviesPct}% levies
                  <span style={{ color: 'var(--ink-3)' }}> · from {tariff.sample} trades</span>
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
            The tariff is derived from the trades in your own book rather than a published rate card, so the planner
            quotes what JS has actually been charging you.
          </p>
        </Panel>

        <Panel title="Sectors" subtitle="Used by the allocation panel and the planner's concentration check" className="lg:col-span-2">
          <SectorForm symbols={v.symbols} sectors={sectors} />
        </Panel>

        <Panel title="Broker figures on record" subtitle={`JS InvestPro portfolio at ${fmtDate(v.data.settings.broker?.asOf ?? v.reportingDate)}`} className="lg:col-span-2">
          <Note>
            The quantities and costs JS reports are stored so the{' '}
            <a href="/reconcile" className="underline underline-offset-2">reconciliation</a> has something to check
            against. They are the broker&apos;s figures, not the book&apos;s, and are never used to compute anything on
            the other screens.
          </Note>
          <table className="book mt-3">
            <thead><tr><th>Symbol</th><th className="num">JS quantity</th><th className="num">JS cost</th></tr></thead>
            <tbody>
              {Object.entries(v.data.settings.broker?.qty ?? {}).sort(([a], [b]) => a.localeCompare(b)).map(([s, q]) => (
                <tr key={s}>
                  <td className="font-medium">{s}</td>
                  <td className="num">{q.toLocaleString('en-IN')}</td>
                  <td className="num">{pkr(v.data.settings.broker?.cost?.[s] ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
