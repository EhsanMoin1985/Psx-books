import type { ReactNode } from 'react';

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
  flush = false,
}: {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  flush?: boolean;
}) {
  return (
    <section className={`panel print-block ${className}`}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-wide uppercase" style={{ color: 'var(--ink-2)' }}>{title}</h2>}
            {subtitle && <p className="text-xs mt-0.5" style={{ color: 'var(--ink-3)' }}>{subtitle}</p>}
          </div>
          {actions && <div className="shrink-0 no-print">{actions}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-4'}>{children}</div>
    </section>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = 'plain',
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: 'plain' | 'pos' | 'neg' | 'warn';
}) {
  const colour = tone === 'pos' ? 'var(--pos)' : tone === 'neg' ? 'var(--neg)' : tone === 'warn' ? 'var(--warn)' : 'var(--ink)';
  return (
    <div className="panel p-3.5 print-block">
      <div className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>{label}</div>
      <div className="mt-1.5 text-xl font-semibold num !text-left" style={{ color: colour }}>{value}</div>
      {sub && <div className="mt-1 text-xs" style={{ color: 'var(--ink-3)' }}>{sub}</div>}
    </div>
  );
}

export function Badge({
  children,
  tone = 'plain',
}: {
  children: ReactNode;
  tone?: 'plain' | 'pos' | 'neg' | 'warn' | 'accent';
}) {
  const map = {
    plain: { bg: 'var(--panel-2)', fg: 'var(--ink-2)', br: 'var(--line-strong)' },
    pos: { bg: 'var(--pos-soft)', fg: 'var(--pos)', br: 'var(--pos)' },
    neg: { bg: 'var(--neg-soft)', fg: 'var(--neg)', br: 'var(--neg)' },
    warn: { bg: 'var(--warn-soft)', fg: 'var(--warn)', br: 'var(--warn)' },
    accent: { bg: 'var(--accent-soft)', fg: 'var(--accent)', br: 'var(--accent)' },
  }[tone];
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[11px] font-medium leading-tight border"
      style={{ background: map.bg, color: map.fg, borderColor: map.br }}
    >
      {children}
    </span>
  );
}

/** A pass or fail line for a reconciliation. */
export function Check({ ok, label, detail }: { ok: boolean; label: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 py-1.5">
      <span
        aria-hidden
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
        style={{ background: ok ? 'var(--pos)' : 'var(--neg)', color: '#fff' }}
      >
        {ok ? '✓' : '!'}
      </span>
      <div className="min-w-0">
        <div className="text-[13px]" style={{ color: 'var(--ink)' }}>{label}</div>
        {detail && <div className="text-xs num !text-left" style={{ color: 'var(--ink-3)' }}>{detail}</div>}
      </div>
      <span className="sr-only">{ok ? 'agrees' : 'does not agree'}</span>
    </div>
  );
}

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-semibold leading-tight">{title}</h1>
        {lede && <p className="mt-1 text-[13px] max-w-3xl" style={{ color: 'var(--ink-2)' }}>{lede}</p>}
      </div>
      {actions && <div className="no-print shrink-0">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="px-4 py-10 text-center text-[13px]" style={{ color: 'var(--ink-3)' }}>
      {children}
    </div>
  );
}

export function Note({ tone = 'plain', children }: { tone?: 'plain' | 'warn' | 'accent'; children: ReactNode }) {
  const bg = tone === 'warn' ? 'var(--warn-soft)' : tone === 'accent' ? 'var(--accent-soft)' : 'var(--panel-2)';
  const br = tone === 'warn' ? 'var(--warn)' : tone === 'accent' ? 'var(--accent)' : 'var(--line-strong)';
  return (
    <div className="rounded border-l-2 px-3 py-2 text-[13px]" style={{ background: bg, borderColor: br, color: 'var(--ink-2)' }}>
      {children}
    </div>
  );
}

export const btn =
  'inline-flex items-center justify-center gap-1.5 rounded border px-3 py-1.5 text-[13px] font-medium transition-colors';
export const btnPrimary = `${btn} border-transparent`;
export const btnPrimaryStyle = { background: 'var(--accent)', color: 'var(--accent-ink)' };
export const btnPlainStyle = { background: 'var(--panel)', borderColor: 'var(--line-strong)', color: 'var(--ink)' };
