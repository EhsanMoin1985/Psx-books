import { DashboardShell, type PanelDef } from '@/components/dashboard/shell';
import { Allocation, EquityAgainstFunds, IncomePanel, KeyFigures, LatestEntries, MoversPanel, ProofPanel } from '@/components/dashboard/panels';
import { PageHeader } from '@/components/ui';
import { SeedBanner } from '@/components/seed-banner';
import { loadView } from '@/lib/data/view';
import { saveLayout } from './actions';
import { fmtDate } from '@/lib/money';

export const metadata = { title: 'Dashboard' };
export const dynamic = 'force-dynamic';

const DEFS: PanelDef[] = [
  { id: 'figures', label: 'Key figures' },
  { id: 'proof', label: 'Control checks' },
  { id: 'equity', label: 'Equity against funds introduced' },
  { id: 'allocation', label: 'Allocation' },
  { id: 'movers', label: 'Positions by return' },
  { id: 'income', label: 'Income and tax' },
  { id: 'latest', label: 'Latest entries' },
];

export default async function DashboardPage() {
  const v = await loadView();
  const panels = {
    figures: <KeyFigures v={v} />,
    proof: <ProofPanel v={v} />,
    equity: <EquityAgainstFunds v={v} />,
    allocation: <Allocation v={v} />,
    movers: <MoversPanel v={v} />,
    income: <IncomePanel v={v} />,
    latest: <LatestEntries v={v} />,
  };

  return (
    <>
      <PageHeader
        title="Dashboard"
        lede={`JS Global Capital account 7808. ${v.data.settings.statement?.period ?? ''}${v.pricedAt ? `, priced at ${fmtDate(v.pricedAt)}.` : '.'}`}
      />
      <SeedBanner mode={v.mode} />
      <DashboardShell defs={DEFS} panels={panels} savedLayouts={v.data.settings.layouts ?? {}} onSave={saveLayout} />
    </>
  );
}
