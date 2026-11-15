'use client';
import { useState } from 'react';
import { useProjects } from '@/components/project-context';
import { detailedTotal, emptyQuick, projectArea, quickTotal, type CostRow, type Mode, type Quick } from '@/lib/costs';
import type { Project } from '@/lib/projects';

const money = (value: number | null) => value === null ? '—' : new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 }).format(value);
const numberText = (value: number | null) => value === null ? '' : String(value);
const inputClass = 'w-full rounded-lg border border-[#dbe5e2] bg-[#fbfcfc] px-3 py-3 text-sm outline-none focus:border-[#3d8173] focus:ring-2 focus:ring-[#dceee8]';

export function CostPanel({ project }: { project: Project }) {
  const { refresh } = useProjects();
  const [mode, setMode] = useState<Mode>(() => project.cost_mode === 'detailed' ? 'detailed' : 'quick');
  const [quick, setQuick] = useState<Quick>(() => { try { return project.quick_cost_data ? JSON.parse(project.quick_cost_data) : emptyQuick(); } catch { return emptyQuick(); } });
  const [rows, setRows] = useState<CostRow[]>(() => { try { return project.detailed_cost_data ? JSON.parse(project.detailed_cost_data) : []; } catch { return []; } });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const area = projectArea(project);
  const total = mode === 'quick' ? quickTotal(area, quick) : detailedTotal(rows);
  const parkingInvalid = quick.parking && quick.parkingArea !== null && area !== null && quick.parkingArea > area;
  const parse = (s: string) => s === '' ? null : Number(s);
  const setField = (key: keyof Quick, value: number | null) => { setQuick(current => ({ ...current, [key]: value })); setMessage(''); };
  const setRow = (id: string, patch: Partial<CostRow>) => { setRows(current => current.map(row => row.id === id ? { ...row, ...patch } : row)); setMessage(''); };
  async function save() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/projects/${project.id}/cost`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, quick, detailed: rows }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Maliyetler kaydedilemedi.');
      try { await refresh(); setMessage('Maliyetler kaydedildi.'); }
      catch { setError('Maliyetler kaydedildi ancak proje bilgileri yenilenemedi. Sayfayı yenileyin.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Maliyetler kaydedilemedi.'); }
    finally { setBusy(false); }
  }
  const fields: { key: 'structureRate' | 'demolition' | 'rent' | 'fees'; label: string }[] = [
    { key: 'structureRate', label: 'Daire / Üst Yapı m² İnşaat Maliyeti' }, { key: 'demolition', label: 'Toplam Yıkım ve Hafriyat Gideri' },
    { key: 'rent', label: 'Toplam Kira ve Taşınma Yardımı' }, { key: 'fees', label: 'Proje, Harç ve Resmi Giderler' },
  ];
  const numeric = (label: string, key: Exclude<keyof Quick, 'parking'>, unit: string) => <label className="block text-sm font-medium">{label}<div className="mt-2 flex items-center gap-2"><input type="number" min="0" step="any" value={numberText(quick[key])} onChange={event => setField(key, parse(event.target.value))} className={inputClass} /><span className="w-7 text-[#788986]">{unit}</span></div></label>;
  return <div className="mt-8">
    <div className="inline-flex rounded-xl bg-[#e8f0ed] p-1" aria-label="Maliyet modu">{([['quick', 'Hızlı Fizibilite'], ['detailed', 'Detaylı Keşif']] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={mode === key} onClick={() => { setMode(key); setError(''); setMessage(''); }} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${mode === key ? 'bg-white text-[#174b48] shadow-sm' : 'text-[#728782]'}`}>{label}</button>)}</div>
    <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-[#68817a]">Toplam genel brüt / inşaat alanı: <strong className="text-[#174b48]">{area === null ? 'Girilmemiş' : `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 }).format(area)} m²`}</strong></div>
    {area === null && mode === 'quick' && <p role="alert" className="mt-3 text-sm text-amber-700">Hızlı hesap için Dosya Yönetimi ekranında toplam inşaat alanını girin.</p>}
    {mode === 'quick' ? <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-5 rounded-2xl border border-[#e2eae8] bg-white p-6"><label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={quick.parking} onChange={e => { setQuick({ ...quick, parking: e.target.checked }); setMessage(''); }} />Yeni Projede Otopark Var mı?</label>
        {quick.parking && <div className="grid gap-4 rounded-xl bg-[#f2f7f5] p-4 sm:grid-cols-2">{numeric('Tahmini Yeni Otopark Alanı', 'parkingArea', 'm²')}{numeric('Otopark m² İnşaat Maliyeti', 'parkingRate', '₺')}</div>}
        {parkingInvalid && <p role="alert" className="text-sm text-red-700">Otopark alanı toplam inşaat alanını aşamaz.</p>}
        <div className="grid gap-5 sm:grid-cols-2">{fields.map(field => <div key={field.key}>{numeric(field.label, field.key, '₺')}</div>)}</div>
      </div>
      <div className="rounded-2xl bg-[#174b48] p-6 text-white"><p className="text-sm text-[#bad3cb]">Genel Toplam Maliyet</p><p className="mt-4 break-words text-3xl font-semibold">{money(total)}</p><div className="mt-6 space-y-3 border-t border-white/20 pt-5 text-sm text-[#d4e4de]"><p>Üst yapı: {money(area !== null && quick.structureRate !== null && !parkingInvalid && (!quick.parking || quick.parkingArea !== null) ? (area - (quick.parking ? quick.parkingArea! : 0)) * quick.structureRate : null)}</p><p>Otopark: {money(!quick.parking ? 0 : quick.parkingArea !== null && quick.parkingRate !== null ? quick.parkingArea * quick.parkingRate : null)}</p><p>Yıkım ve hafriyat: {money(quick.demolition)}</p><p>Kira ve taşınma: {money(quick.rent)}</p><p>Proje ve harçlar: {money(quick.fees)}</p></div></div>
    </div> : <div className="mt-6 rounded-2xl border border-[#e2eae8] bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">Keşif kalemleri</h2><p className="mt-1 text-sm text-[#788986]">Miktar ve birim fiyatla her gideri hesaplayın.</p></div><button type="button" onClick={() => { setRows([...rows, { id: crypto.randomUUID(), name: '', quantity: null, unit: '', price: null }]); setMessage(''); }} className="rounded-lg border border-[#8bb9ab] px-4 py-2.5 text-sm font-semibold text-[#216a5e]">+ Yeni Kalem Ekle</button></div>
      <div className="mt-5 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="text-xs text-[#748b83]"><tr><th className="p-2">Gider Adı</th><th className="p-2">Miktar</th><th className="p-2">Birim</th><th className="p-2">Birim Fiyat (₺)</th><th className="p-2">Toplam</th><th className="p-2"><span className="sr-only">Sil</span></th></tr></thead><tbody>{rows.map((row, i) => <tr key={row.id} className="border-t border-[#edf1ef]"><td className="p-2"><input aria-label={`${i + 1}. gider adı`} maxLength={200} value={row.name} onChange={e => setRow(row.id, { name: e.target.value })} className={inputClass} /></td><td className="p-2"><input aria-label={`${i + 1}. miktar`} type="number" min="0" step="any" value={numberText(row.quantity)} onChange={e => setRow(row.id, { quantity: parse(e.target.value) })} className={inputClass} /></td><td className="p-2"><input aria-label={`${i + 1}. birim`} maxLength={50} placeholder="Ton, m³, ay" value={row.unit} onChange={e => setRow(row.id, { unit: e.target.value })} className={inputClass} /></td><td className="p-2"><input aria-label={`${i + 1}. birim fiyat`} type="number" min="0" step="any" value={numberText(row.price)} onChange={e => setRow(row.id, { price: parse(e.target.value) })} className={inputClass} /></td><td className="whitespace-nowrap p-2 font-semibold">{money(row.quantity === null || row.price === null ? null : row.quantity * row.price)}</td><td className="p-2"><button type="button" aria-label={`${i + 1}. kalemi sil`} onClick={() => { setRows(rows.filter(item => item.id !== row.id)); setMessage(''); }} className="rounded p-2 text-[#a44747]">✕</button></td></tr>)}</tbody></table>{rows.length === 0 && <p className="py-10 text-center text-sm text-[#899a96]">Henüz gider kalemi eklenmedi.</p>}</div>
      <div className="mt-5 rounded-xl bg-[#174b48] p-6 text-white"><p className="text-sm text-[#bad3cb]">Genel Toplam Maliyet</p><p className="mt-2 text-3xl font-semibold">{money(rows.length ? total : null)}</p></div>
    </div>}
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-4 text-sm text-[#236b53]">{message}</p>}
    <button type="button" disabled={busy} onClick={save} className="mt-6 rounded-lg bg-[#174b48] px-6 py-3 text-sm font-semibold text-white hover:bg-[#22645b] disabled:opacity-60">{busy ? 'Kaydediliyor…' : 'Maliyetleri Kaydet'}</button>
  </div>;
}
