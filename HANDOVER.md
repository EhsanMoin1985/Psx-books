# PSX Books — build brief for Claude Code

Paste this whole file into a new Claude Code cloud session, along with `schema.sql`,
`psx-books-data.json` and `transactions.csv`, and say: "Build this."

## What it is

A personal investment book for one user (a chartered accountant in Auckland trading on the
Pakistan Stock Exchange through JS Global Capital, account 7808). It already exists as a
Claude artifact; this is the rebuild outside Claude so prices can update automatically.

Amounts are Pakistani rupees, displayed with lakh/crore grouping (`en-IN`), with a toggle to
show everything in NZD at a stored rate. Prices are always entered and stored in PKR.

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel (free tier).
- Supabase Postgres + Auth (email magic link, single user), free tier.
- A Vercel cron job for prices and alerts. Email alerts via Resend free tier.
- No native app for now. The site must work well installed to an Android and iOS home screen
  (manifest, icons, `viewport-fit=cover`, safe-area insets, dark mode).

## Data

`schema.sql` creates: `transactions`, `prices`, `watchlist`, `alerts`, `plans`, `settings`
(a single JSONB document per user for fx rate, broker quantities, statement totals, opening
prices, dashboard layout and saved views), plus a `holdings` view and row-level security.

`psx-books-data.json` holds 61 real transactions and the current settings. Import it as is.
Transaction shape: `trade_date, type, symbol, qty, price, commission, amount (signed net),
gross (dividends before tax), stmt_balance, external, voucher, note, source`.

Types: OPEN, BUY, SELL, DEPOSIT, WITHDRAWAL, DIVIDEND, MARKUP, CGT, FEE.

## Accounting rules that must not drift

1. `amount` is the signed net amount exactly as the broker statement shows it, including
   commission, CVT and exchange levies. Debits negative, credits positive.
2. Cash is proved line by line against `stmt_balance`. A recomputed running balance must match
   on every row that has one. Current control totals: debits 5,596,445.37, credits 5,997,489.53,
   closing 401,044.16 at 18 Sep 2026.
3. Holdings use weighted average cost on net amounts. JS uses FIFO, so ATRL differs by about
   Rs 364; the reconciliation page must show cost per the books against cost per JS and explain
   the difference rather than hide it.
4. Sales with no matching purchase in the data are disposals of pre-2026 holdings: book the
   proceeds, book no gain, and list them separately.
5. `external: true` means the cash settled outside the broker (dividends paid to the owner's
   bank). Include it in income and in total return, exclude it from broker cash and from the
   cash flow statement, and disclose it as a non-cash transaction.
6. Capital gains tax is billed monthly by NCCPL in arrears. Accrue at 15% on gains realised
   since the last billed month, and label it an estimate.
7. Dividends are recorded gross with withholding tax (15% filer rate) shown as tax expense.

## Screens to build

Port these from the artifact, then add the new ones.

- **Dashboard** — cash, holdings at cost, unrealised gain/loss, current value, portfolio equity
  against funds introduced, allocation table, latest entries.
- **Holdings** — quantity, average cost, book cost, last price, market value, unrealised, drill
  down to every trade in a symbol.
- **Ledger** — full cash book with recomputed running balance, broker balance check per line,
  filters, CSV export.
- **Reconcile** — statement control totals, quantities and cost against JS, pre-2026 holdings
  with an input for their 31 Dec 2025 closing price.
- **Reports** — realised gains by symbol and by month, CGT by month with effective rate,
  expected CGT on unbilled gains, cost of trading.
- **Financial statements (IFRS)** — statement of financial position, profit or loss and OCI,
  changes in equity, cash flows (direct method), and notes 1–8 covering basis of preparation,
  policies, fair value hierarchy (Level 1), net gains, tax including the unrecognised deferred
  tax asset, financial risk and concentration, other disclosures and subsequent events.
  Securities are held for trading, so FVTPL under IFRS 9: transaction costs are expensed, not
  capitalised, and the statements are computed on gross trade prices. The page must always
  balance; show a "balanced and reconciled" check. Print to PDF must work.

New in this build:

- **Trade planner** — draft an order before placing it in JS: position size against available
  cash, estimated commission and CGT, effect on sector concentration. Mark it placed, then
  filled, which creates the ledger entry so nothing is typed twice.
- **Watchlist and alerts** — target buy and sell levels per symbol; the cron job checks them
  after each price refresh and emails when crossed.
- **Custom dashboard** — the user chooses which panels appear and in what order, with saved
  layouts stored per device in `settings`.

## Price refresh

The cron job runs on weekdays at PSX open and close (09:32 and 15:30 PKT, which is 04:32 and
10:30 UTC) and writes one row per symbol per day into `prices`.

The price source is not yet decided; build it behind a `PriceSource` interface with a manual
paste/import adapter as the default, so a vendor adapter can be dropped in later. Do not scrape
the PSX portal: PSX licenses its market data and prohibits redistribution.

## Working style the owner expects

Complete, deployable work rather than prototypes. Plain, professional UI in the spirit of Xero
or Oracle Financials, not a toy tracker. Correct numbers first: if a figure cannot be verified,
say so instead of estimating. Test against the real data before declaring anything done.

## First tasks

1. Create the repo, run `schema.sql` against Supabase, import the JSON, verify the control
   totals above reconcile.
2. Ship the dashboard, holdings, ledger and reconcile pages, deployed to Vercel.
3. Then reports and financial statements, then planner, watchlist and custom layout.
