import { PlannerForm } from '@/components/planner-form';
import { PlanList } from '@/components/plan-list';
import { Note, Panel, PageHeader } from '@/components/ui';
import { loadView } from '@/lib/data/view';
import { costPlan, type PlanCosting } from '@/lib/engine/planner';
import { pktDate } from '@/lib/prices/source';

export const metadata = { title: 'Trade planner' };
export const dynamic = 'force-dynamic';

export default async function PlannerPage() {
  const v = await loadView();

  async function cost(input: { symbol: string; side: 'BUY' | 'SELL'; qty: number; limitPrice: number | null }): Promise<PlanCosting | null> {
    'use server';
    const view = await loadView();
    if (!input.symbol || !Number.isFinite(input.qty) || input.qty <= 0) return null;
    return costPlan(
      { symbol: input.symbol.toUpperCase(), side: input.side, qty: input.qty, limitPrice: input.limitPrice },
      view.book,
      view.cash,
      view.data.transactions,
      view.data.settings,
    );
  }

  const options = v.book.holdings.map((h) => ({ symbol: h.symbol, qty: h.qty, close: h.close, avgCost: h.avgCost }));
  const plans = v.data.plans.slice().sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <>
      <PageHeader
        title="Trade planner"
        lede="Work out what an order costs and what it does to the book before you place it with JS. Mark it filled and the cash book row is raised from the plan, so nothing is typed twice."
      />

      <div className="mb-4">
        <PlannerForm options={options} symbols={v.symbols} cash={v.cash} cost={cost} />
      </div>

      <Panel title="Plans" subtitle="Draft, placed, filled or cancelled" flush>
        <PlanList plans={plans} today={pktDate()} />
        <div className="border-t p-4" style={{ borderColor: 'var(--line)' }}>
          <Note>
            Marking a plan filled raises a cash book row at the price you confirm, with commission and levies at your own
            historic rates. The row carries no broker balance until the statement arrives, so the{' '}
            <a href="/ledger" className="underline underline-offset-2">ledger</a> will show it as unproved. Replace the
            estimated commission with the figure on the contract note when you have it.
          </Note>
        </div>
      </Panel>
    </>
  );
}
