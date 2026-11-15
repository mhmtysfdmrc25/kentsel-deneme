'use client';

import { useId, useMemo, useState } from 'react';
import type { Project } from '@/lib/projects';

export type FrequentField = 'semt' | 'mahalle' | 'kaks' | 'taks';

export function FrequentInput({ field, value, projects, onChange, className }: {
  field: FrequentField;
  value: string;
  projects: Project[];
  onChange: (value: string) => void;
  className: string;
}) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const numeric = field === 'kaks' || field === 'taks';
  const suggestions = useMemo(() => {
    const counts = new Map<string, { value: string; count: number }>();
    for (const project of projects) {
      const raw = project[field];
      if (raw == null || (typeof raw === 'string' && !raw.trim())) continue;
      const display = String(raw).trim().normalize('NFC');
      const key = numeric ? String(Number(raw)) : display.toLocaleLowerCase('tr-TR');
      if (numeric && !Number.isFinite(Number(raw))) continue;
      const entry = counts.get(key);
      if (entry) entry.count++;
      else counts.set(key, { value: numeric ? key : display, count: 1 });
    }
    return [...counts.values()].filter(entry => entry.count >= 3)
      .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value, 'tr', { numeric: true }));
  }, [projects, field, numeric]);
  return <div className="relative" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} onKeyDown={event => {
    if (event.key === 'Escape') setOpen(false);
  }}>
    <input id={field} type={numeric ? 'number' : 'text'} min={numeric ? 0 : undefined} step={numeric ? '0.01' : undefined} maxLength={numeric ? undefined : 100} value={value} onChange={event => onChange(event.target.value)} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} aria-expanded={open && suggestions.length > 0} aria-controls={open && suggestions.length > 0 ? listId : undefined} autoComplete="off" className={className} />
    {open && suggestions.length > 0 && <div id={listId} className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-[#dbe5e2] bg-white shadow-lg">
      <p className="px-3 py-2 text-xs font-semibold text-[#70817e]">Sık kullanılanlar</p>
      <div className="max-h-48 overflow-y-auto">{suggestions.map(entry => <button key={entry.value} type="button" onClick={() => { onChange(entry.value); setOpen(false); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-[#174b48] hover:bg-[#edf5f1] focus:bg-[#edf5f1]"><span>{entry.value}</span><span className="text-xs text-[#839791]">{entry.count} proje</span></button>)}</div>
    </div>}
  </div>;
}
