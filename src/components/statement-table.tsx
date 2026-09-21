import { Money } from './money';
import type { Line } from '@/lib/engine/ifrs';

/** A statement column: labels left, one figure column right, notes cross-referenced. */
export function StatementTable({ lines, caption }: { lines: Line[]; caption?: string }) {
  return (
    <table className="book" aria-label={caption}>
      <thead className="sr-only">
        <tr><th>Item</th><th>Note</th><th className="num">Amount</th></tr>
      </thead>
      <tbody>
        {lines.map((l, i) => (
          <tr key={`${l.label}-${i}`}>
            <td className={l.total ? 'rule-top font-semibold' : ''} style={{ paddingLeft: l.indent ? 24 : undefined }}>
              {l.label}
            </td>
            <td className={`w-10 text-center ${l.total ? 'rule-top' : ''}`} style={{ color: 'var(--ink-3)' }}>
              {l.note ?? ''}
            </td>
            <td className={`num ${l.total ? 'rule-top font-semibold' : ''}`}>
              <Money value={l.value} accounting dashZero={!l.total} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
