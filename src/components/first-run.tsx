'use client';

import { useState, useTransition } from 'react';
import { Note, Panel, btnPrimary, btnPrimaryStyle } from './ui';
import { importSeedBook } from '@/app/actions';

/**
 * Shown once, when a Supabase project is connected but the book is empty.
 * Loads the 61 shipped transactions as the signed-in owner, so the setup never
 * needs a terminal or a service role key.
 */
export function FirstRun() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ error: string | null; imported: { transactions: number; prices: number } | null } | null>(null);

  if (result?.imported) {
    return (
      <Panel title="The book is loaded">
        <Note>
          {result.imported.transactions} transactions and {result.imported.prices} prices are in your Supabase project.
          Open <a href="/reconcile" className="underline underline-offset-2">Reconcile</a> and check that cash proves on
          all 59 rows before you rely on anything here.
        </Note>
      </Panel>
    );
  }

  return (
    <Panel title="Load the book" subtitle="Your database is connected but empty">
      <p className="text-[13px] mb-3" style={{ color: 'var(--ink-2)' }}>
        This brings in the 61 transactions from the JS Global statement, the closing prices and the broker figures the
        reconciliation checks against. Everything is written as you, under row level security, so no service key is
        needed and nobody else can read it.
      </p>
      <button
        type="button"
        className={btnPrimary}
        style={btnPrimaryStyle}
        disabled={pending}
        onClick={() => start(async () => setResult(await importSeedBook()))}
      >
        {pending ? 'Loading the book…' : 'Load the book'}
      </button>
      {result?.error && (
        <div className="mt-3">
          <Note tone="warn">{result.error}</Note>
        </div>
      )}
      <p className="mt-3 text-xs" style={{ color: 'var(--ink-3)' }}>
        It runs once. If the book already holds transactions it refuses and changes nothing, so this cannot double up
        your ledger.
      </p>
    </Panel>
  );
}
