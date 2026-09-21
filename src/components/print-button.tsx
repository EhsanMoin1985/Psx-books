'use client';
import { btn, btnPlainStyle } from './ui';

export function PrintButton({ label = 'Print or save as PDF' }: { label?: string }) {
  return (
    <button type="button" className={btn} style={btnPlainStyle} onClick={() => window.print()}>
      {label}
    </button>
  );
}
