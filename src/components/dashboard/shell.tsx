'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { btn, btnPlainStyle, Note } from '@/components/ui';

export interface PanelDef {
  id: string;
  label: string;
  /** Panels that fill the row on their own. */
  wide?: boolean;
}

const KEY = 'psx-books:layout';

/**
 * Chooses which dashboard panels appear and in what order.
 *
 * Named layouts live in the book's settings, so they follow the owner between
 * devices. Which layout a device shows, and any unsaved tweak to it, lives in
 * that device's own storage, so a phone can differ from a desktop.
 */
export function DashboardShell({
  defs,
  panels,
  savedLayouts,
  onSave,
}: {
  defs: PanelDef[];
  panels: Record<string, ReactNode>;
  savedLayouts: Record<string, string[]>;
  onSave: (name: string, order: string[]) => Promise<void>;
}) {
  const allIds = useMemo(() => defs.map((d) => d.id), [defs]);
  const [order, setOrder] = useState<string[]>(allIds);
  const [editing, setEditing] = useState(false);
  const [layoutName, setLayoutName] = useState('Default');
  const [saving, setSaving] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw) as { name?: string; order?: string[] };
        if (p.name) setLayoutName(p.name);
        if (Array.isArray(p.order)) setOrder(reconcile(p.order, allIds));
      }
    } catch {
      /* storage blocked: the default layout stands */
    }
    setLoaded(true);
  }, [allIds]);

  const persist = (name: string, next: string[]) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ name, order: next }));
    } catch {
      /* ignore */
    }
  };

  const update = (next: string[]) => {
    setOrder(next);
    persist(layoutName, next);
    setSaving('idle');
  };

  const move = (id: string, by: number) => {
    const i = order.indexOf(id);
    const j = i + by;
    if (i < 0 || j < 0 || j >= order.length) return;
    const next = order.slice();
    [next[i], next[j]] = [next[j], next[i]];
    update(next);
  };

  const toggle = (id: string) => {
    update(order.includes(id) ? order.filter((x) => x !== id) : [...order, id]);
  };

  const applySaved = (name: string) => {
    setLayoutName(name);
    const next = reconcile(savedLayouts[name] ?? allIds, allIds);
    setOrder(next);
    persist(name, next);
  };

  const save = async () => {
    setSaving('saving');
    try {
      await onSave(layoutName, order);
      setSaving('saved');
    } catch {
      setSaving('error');
    }
  };

  // Rendering the default order until storage is read avoids a layout flash.
  const shown = loaded ? order : allIds;
  const hidden = defs.filter((d) => !shown.includes(d.id));

  return (
    <>
      <div className="no-print mb-3 flex flex-wrap items-center gap-2">
        <button type="button" className={btn} style={btnPlainStyle} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done' : 'Choose panels'}
        </button>
        {Object.keys(savedLayouts).length > 0 && (
          <label className="flex items-center gap-1.5 text-[12px]" style={{ color: 'var(--ink-3)' }}>
            Layout
            <select
              className="w-auto py-1 text-[12px]"
              value={Object.keys(savedLayouts).includes(layoutName) ? layoutName : ''}
              onChange={(e) => e.target.value && applySaved(e.target.value)}
            >
              <option value="">Custom</option>
              {Object.keys(savedLayouts).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {editing && (
        <div className="no-print mb-4 panel p-4 space-y-3">
          <Note>
            Named layouts are saved to the book and follow you between devices. Which layout this device shows, and any
            change you have not saved, stays on this device.
          </Note>
          <ul className="space-y-1">
            {shown.map((id, i) => {
              const def = defs.find((d) => d.id === id);
              if (!def) return null;
              return (
                <li key={id} className="flex items-center gap-2 rounded px-2 py-1.5" style={{ background: 'var(--panel-2)' }}>
                  <span className="flex-1 text-[13px]">{def.label}</span>
                  <button type="button" onClick={() => move(id, -1)} disabled={i === 0} className="rounded border px-2 py-0.5 text-[12px] disabled:opacity-30" style={btnPlainStyle} aria-label={`Move ${def.label} up`}>↑</button>
                  <button type="button" onClick={() => move(id, 1)} disabled={i === shown.length - 1} className="rounded border px-2 py-0.5 text-[12px] disabled:opacity-30" style={btnPlainStyle} aria-label={`Move ${def.label} down`}>↓</button>
                  <button type="button" onClick={() => toggle(id)} className="rounded border px-2 py-0.5 text-[12px]" style={btnPlainStyle}>Hide</button>
                </li>
              );
            })}
          </ul>
          {hidden.length > 0 && (
            <div>
              <div className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--ink-3)' }}>Hidden</div>
              <div className="flex flex-wrap gap-1.5">
                {hidden.map((d) => (
                  <button key={d.id} type="button" onClick={() => toggle(d.id)} className="rounded border px-2 py-1 text-[12px]" style={btnPlainStyle}>
                    + {d.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              className="w-40 py-1 text-[13px]"
              value={layoutName}
              onChange={(e) => setLayoutName(e.target.value)}
              aria-label="Layout name"
              placeholder="Layout name"
            />
            <button type="button" className={btn} style={btnPlainStyle} onClick={save} disabled={!layoutName.trim() || saving === 'saving'}>
              {saving === 'saving' ? 'Saving…' : 'Save layout to the book'}
            </button>
            <button type="button" className={btn} style={btnPlainStyle} onClick={() => update(allIds)}>Reset</button>
            {saving === 'saved' && <span className="text-[12px]" style={{ color: 'var(--pos)' }}>Saved.</span>}
            {saving === 'error' && <span className="text-[12px]" style={{ color: 'var(--neg)' }}>Could not save.</span>}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {shown.map((id) => (
          <div key={id}>{panels[id]}</div>
        ))}
      </div>
    </>
  );
}

/** Drops panels that no longer exist, and falls back to showing everything if that empties the layout. */
function reconcile(order: string[], all: string[]): string[] {
  const kept = order.filter((id) => all.includes(id));
  return kept.length ? kept : all;
}
