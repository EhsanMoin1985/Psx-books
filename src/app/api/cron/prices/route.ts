import { NextResponse } from 'next/server';
import { getRepo } from '@/lib/data/repo';
import { latestPrices } from '@/lib/engine/holdings';
import { alertEmail, crossings } from '@/lib/engine/alerts';
import { sendEmail } from '@/lib/email';
import { isTradingDay, pktDate, quotesToPrices, resolveSource } from '@/lib/prices/source';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Refreshes prices and checks alerts. Vercel calls this on weekdays at the
 * Pakistan open and close; see vercel.json.
 *
 * It never invents a price. If no source can run, it says so and changes
 * nothing, so a stale mark is visible as a stale date rather than hidden
 * behind a fresh one.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');
  // Vercel sends `Authorization: Bearer $CRON_SECRET` on scheduled invocations.
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const today = pktDate();
  const url = new URL(req.url);
  const force = url.searchParams.get('force') === '1';
  if (!isTradingDay(today) && !force) {
    return NextResponse.json({ ok: true, skipped: 'not a trading day in Pakistan', date: today });
  }

  const repo = await getRepo();
  const data = await repo.load();
  const symbols = [...new Set(data.transactions.map((t) => t.symbol).filter((s): s is string => Boolean(s)))];
  const watched = data.watchlist.map((w) => w.symbol);
  const wanted = [...new Set([...symbols, ...watched])];

  const source = resolveSource();
  const why = source.unavailable();
  if (why) {
    return NextResponse.json({
      ok: false,
      date: today,
      source: source.id,
      wrote: 0,
      reason: `No price source could run: ${why} Prices are unchanged; the marks on screen keep their own date.`,
    });
  }

  let wrote = 0;
  let fetchError: string | null = null;
  try {
    const quotes = await source.fetch(wanted, today);
    wrote = await repo.upsertPrices(quotesToPrices(quotes, source.label));
  } catch (e) {
    fetchError = e instanceof Error ? e.message : String(e);
  }

  // Alerts are checked against whatever is stored now, refreshed or not.
  const fresh = await repo.load();
  const latest = latestPrices(fresh.prices, fresh.settings);
  const crossed = crossings(fresh.alerts, latest);

  let emailed: { sent: boolean; reason?: string } = { sent: false, reason: 'no alerts crossed' };
  if (crossed.length) {
    const { subject, text } = alertEmail(crossed, today);
    emailed = await sendEmail(subject, text);
    // Switch each alert off whether or not the mail went, so a broken mailer
    // does not turn into a repeated send once it is fixed.
    for (const c of crossed) {
      await repo.updateAlert(c.alert.id, { active: false, fired_at: new Date().toISOString() });
    }
  }

  return NextResponse.json({
    ok: !fetchError,
    date: today,
    source: source.id,
    wrote,
    symbols: wanted.length,
    error: fetchError,
    crossed: crossed.map((c) => ({ symbol: c.alert.symbol, direction: c.alert.direction, level: c.alert.level, price: c.price })),
    emailed,
  });
}
