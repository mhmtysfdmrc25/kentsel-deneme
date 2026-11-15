'use client';
import { buildMeasure, validateMeasure, type Measure } from '@/lib/metraj';
import type { Building } from '@/lib/buildings';

export function MeasureModal({ buildings, area, value, onChange, onClose, onSave }: { buildings: Building[]; area: number; value: Measure; onChange: (value: Measure) => void; onClose: () => void; onSave: (value: Measure) => void }) {
  const current = buildMeasure(buildings, area, value);
  let error = '';
  try { validateMeasure(buildings, area, current); } catch (e) { error = e instanceof Error ? e.message : 'Metraj kontrol edilemedi.'; }
  const inputClass = 'w-full rounded-lg border border-[#dbe5e2] bg-white px-3 py-2 text-sm disabled:bg-[#edf4f1]';
  const format = (n: number | null) => n === null ? '' : String(Number(n.toFixed(4)));
  function update(b: number, f: number, apartment: number | null, key: 'net' | 'brut' | 'ortak_alan', raw: string) {
    const next = structuredClone(current);
    const number = raw === '' ? null : Number(raw);
    if (apartment === null) next.binalar[b].katlar[f].ortak_alan = number;
    else if (key === 'net' || key === 'brut') next.binalar[b].katlar[f].daireler[apartment][key] = number;
    onChange(buildMeasure(buildings, area, next));
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div role="dialog" aria-modal="true" aria-labelledby="measure-title" onKeyDown={e => { if (e.key === 'Escape') onClose(); }} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
    <div className="flex justify-between"><h2 id="measure-title" className="text-xl font-semibold">Daire m² düzenle</h2><button type="button" onClick={onClose} aria-label="Kapat">✕</button></div>
    <p className="mt-2 text-sm text-[#70817e]">Artan alan tüm projedeki dairelere eşit dağıtılır. Alanlar m² cinsindendir.</p>
    {current.binalar.map((b, bi) => <section key={bi} className="mt-6 rounded-xl border border-[#dce8e3] p-4"><h3 className="font-semibold">{b.bina_adi}</h3>{b.katlar.filter(f => f.daireler.length > 0).map(floor => { const fi = b.katlar.indexOf(floor); return <div key={floor.id} className="mt-5 border-t border-[#e2eae8] pt-4"><h4 className="font-semibold">{floor.ad}</h4><label className="mt-3 block max-w-xs text-sm">Kat Ortak Alanı (m²)<input type="number" min="0" step="any" value={floor.ortak_alan ?? ''} onChange={e => update(bi, fi, null, 'ortak_alan', e.target.value)} className={inputClass} /></label>{floor.daireler.map((a, ai) => <div key={ai} className="mt-4 rounded-lg bg-[#f7faf8] p-3"><p className="mb-2 text-sm font-semibold">{ai + 1}. Daire</p><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Daire Net <span className="text-xs text-[#70817e]">Süpürülebilir Alan</span><input type="number" min="0" step="any" value={a.net ?? ''} onChange={e => update(bi, fi, ai, 'net', e.target.value)} className={inputClass} /></label>
      <label className="text-sm">Daire Brüt <span className="text-xs text-[#70817e]">Duvarlar Dahil</span><input type="number" min="0" step="any" value={a.brut ?? ''} onChange={e => update(bi, fi, ai, 'brut', e.target.value)} className={inputClass} /></label>
      <label className="text-sm">Kat Brüt<input readOnly value={format(a.kat_brut)} className={inputClass} /></label>
      <label className="text-sm">Genel Brüt <span className="text-xs text-[#70817e]">Otopark, sosyal alan dahil</span><input readOnly value={format(a.genel_brut)} className={inputClass} /></label>
    </div></div>)}</div>; })}</section>)}
    <div className="mt-6 rounded-lg bg-[#f2f7f4] p-4 text-sm">Kat brüt toplamı: {format(current.toplam_kat_brut) || '—'} m² · Artan alan: {format(current.artan_alan) || '—'} m² · Genel brüt toplamı: {format(current.toplam_genel_brut) || '—'} m²</div>
    {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    <button type="button" disabled={!!error} onClick={() => onSave(validateMeasure(buildings, area, current))} className="mt-4 rounded-lg bg-[#174b48] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Kaydet</button>
  </div></div>;
}
