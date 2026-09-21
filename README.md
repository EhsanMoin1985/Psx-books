# PSX Books

A personal investment book for one owner: a Pakistan Stock Exchange portfolio
held through JS Global Capital, account 7808. Amounts are rupees, shown with
lakh and crore grouping, with a toggle that converts the display to New Zealand
dollars at a stored rate. Prices are always entered and held in rupees.

Next.js on Vercel, Supabase Postgres and Auth, a scheduled job for prices and
alerts. Works installed to an Android or iOS home screen.

## The numbers, and how they are checked

The book carries 61 real transactions. `npm test` proves the following against
that data, so a change that breaks any of it fails the suite rather than
quietly restating the accounts.

| Check | Result |
| --- | --- |
| Cash proved line by line against `stmt_balance` | 59 of 59 broker rows agree to the cent |
| Statement control totals | debits 5,596,445.37, credits 5,997,489.53, closing 401,044.16 — all exact |
| Quantities against the JS portfolio | every symbol agrees |
| Cost against JS | differs by 386.94, explained in full: 364.00 weighted average against FIFO on ATRL, 22.94 JS rounding its average rate to 2 dp |
| Financial statements | balance, and still balance once 31 Dec 2025 prices are entered |
| `holdings` view in `schema.sql` | agrees with the TypeScript engine on every symbol (`scripts/verify-view.sh`) |

## Accounting rules the code holds to

1. `amount` is the signed net amount exactly as the broker statement shows it,
   including commission, CVT and exchange levies. Debits negative.
2. The running balance is recomputed from the opening row forward and compared
   with the broker's own balance on every row that has one. The ledger marks
   each row *agrees*, *out by x*, or *no broker balance*.
3. Holdings use a **moving** weighted average on net amounts: cost is relieved
   as units are sold, not averaged over every purchase ever made. JS relieves
   cost first in, first out, so the two differ while a position is open and has
   been bought at more than one price. The reconciliation splits the difference
   into cost method and rounding and explains both.
4. Units sold with no matching purchase are inferred as holdings carried in
   from before the books open — NBP 10, KEL 1,000, SEARL 113. Their disposals
   book proceeds and no gain, and are listed separately. Entering their
   31 December 2025 closing price on the reconciliation gives them a deemed
   cost; that moves the split between opening equity and gain, and no total.
5. `external: true` means the cash settled outside the broker. Such rows are in
   income and total return, out of broker cash and out of the cash flow
   statement, and disclosed as a non-cash transaction.
6. Capital gains tax is billed monthly in arrears by NCCPL. The book accrues
   15 per cent on gains realised since the last billed month and labels it an
   estimate. Months on or before the last billed month that were never charged
   are shown as *not charged* and raise no accrual.
7. Dividends are recorded gross, with withholding tax at the 15 per cent filer
   rate as tax expense.

The financial statements are on a different basis from the rest of the app, and
say so. The securities are held for trading, so they are at fair value through
profit or loss under IFRS 9: transaction costs are expensed rather than
capitalised, cost is measured on gross trade prices, and other comprehensive
income is nil. Every other screen is on the books basis, where those costs sit
inside cost. Note 4 reconciles the two.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # the accounting suite
npm run typecheck
npm run build
```

With no Supabase credentials the app runs on `psx-books-data.json`. Every
figure on every screen is computed from that real data, but anything you add
lasts only until the server restarts, and a banner says so.

## Connecting Supabase

1. Create a project. Run `schema.sql` in the SQL editor.
2. Put `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
   `.env.local` (see `.env.example`).
3. Start the app and sign in once with a magic link, so the owner row exists.
4. Load the book:

   ```bash
   SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… OWNER_EMAIL=you@example.com npm run seed
   ```

   It refuses to run against an owner who already has transactions unless you
   pass `--force`, so it cannot double up a book.
5. Open **Reconcile** and confirm cash proves on all 59 rows.

Every table is protected by row level security keyed to `auth.uid()`, so a row
is only ever visible and writable to its owner. `schema.sql` has been applied to
PostgreSQL 16 and that isolation tested, including that a cross-owner write is
rejected.

`transactions` has no `seq` column; statement order within a day comes from
`created_at`, which the seed script sets in statement order.

## Prices

Prices sit behind a `PriceSource`. The default adapter takes a paste from the
owner's own InvestPro portfolio screen, on **Settings**; it accepts commas, tabs
or spaces, one symbol and price per line, and reports what it could not read
instead of guessing. Set `PRICE_VENDOR_URL` and `PRICE_VENDOR_KEY` to drop in a
licensed vendor feed; nothing else changes.

**The PSX portal is never read.** PSX licenses its market data and prohibits
redistribution.

`vercel.json` runs `/api/cron/prices` on weekdays at 04:32 and 10:30 UTC, which
is the Pakistan open and close. The route:

- skips days that are not weekdays in Pakistan, and takes `?force=1` to
  override;
- writes one row per symbol per day into `prices`;
- checks alerts against whatever is stored, refreshed or not, and emails
  crossings through Resend;
- disarms each alert it fires, whether or not the mail went, so a broken mailer
  cannot turn into a burst of repeats once it is fixed;
- **never invents a price.** With no source available it changes nothing and
  returns the reason, so a stale mark shows as a stale date.

Set `CRON_SECRET` in Vercel; the route checks the `Authorization` header
against it.

## Layout

```
schema.sql                    tables, row level security, the holdings view
psx-books-data.json           the seed book: 61 transactions and settings
scripts/seed.ts               loads the seed into Supabase
scripts/verify-view.sh        proves the SQL view agrees with the engine
src/lib/engine/               the accounting, with no React in it
  ledger.ts                   running balance, cash proof, control totals
  holdings.ts                 moving weighted average, disposals, pre-2026 units
  reports.ts                  realised gains, CGT, income, cost of trading
  ifrs.ts                     the financial statements and their checks
  planner.ts                  order costing, tariff derived from real trades
  alerts.ts                   crossings and watchlist distances
src/lib/prices/source.ts      the PriceSource interface and its adapters
src/lib/data/                 repository, seed loader, per-request view model
src/app/                      the screens
tests/                        the accounting suite
```

The engine is plain TypeScript with no React or database in it, which is why it
can be tested directly against the real book.

## Deploying

Push to GitHub, import into Vercel, set the environment variables from
`.env.example`, deploy. The cron schedule in `vercel.json` is picked up
automatically. Add the Vercel URL to Supabase's redirect allow list so magic
links come back to it.

## Notes

- The statements print to PDF from the browser. A note's table will not split
  across a column or a page.
- Dashboard panels are chosen and ordered per device; named layouts are saved
  to the book and follow the owner between devices.
- The planner's commission and levy rates are derived from the owner's own
  trades, not a published rate card, and the cost it estimates for a sale is
  the figure the ledger will actually relieve.
- These statements are prepared by the owner for the owner. They are not
  audited.
