import { LedgerTable } from '@/components/ledger-table';
import { Money } from '@/components/money';
import { PageHeader, Stat } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { pkr } from '@/lib/money';

export const metadata = { title: 'Ledger' };
export const dynamic = 'force-dynamic';

export default async function LedgerPage() {
  const v = await loadView();
  const p = v.proof;

  return (
    <>
      <PageHeader
        title="Ledger"
        lede="The full cash book. The balance column is recomputed from the opening row forward and compared with the balance the broker printed, row by row."
      />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Debits" value={<Money value={p.debits} />} sub="Rows charged to the account" />
        <Stat label="Credits" value={<Money value={p.credits} />} sub="Rows credited to the account" />
        <Stat label="Closing balance" value={<Money value={p.closing} />} sub={`Broker shows ${pkr(p.expected.closing ?? p.closing)}`} />
        <Stat
          label="Rows that prove"
          value={`${p.checked - p.mismatches.length} of ${p.checked}`}
          tone={p.mismatches.length ? 'neg' : 'pos'}
          sub={p.mismatches.length ? 'Some rows disagree with the broker' : 'Every broker balance agrees to the cent'}
        />
      </div>
      <LedgerTable rows={v.ledger} symbols={v.symbols} />
    </>
  );
}
