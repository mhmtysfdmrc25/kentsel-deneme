'use client';
import { distributionError, MAX_FLOORS, type Building } from '@/lib/buildings';

export function BuildingCards({ buildings, onChange }: { buildings: Building[]; onChange: (index: number, value: Building) => void }) {
  const input = 'w-full rounded-lg border border-[#dbe5e2] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#3d8173] disabled:bg-[#eef2f1] disabled:text-[#91a29d]';
  return <div className="mt-7 space-y-4">{buildings.map((b, i) => {
    const set = (patch: Partial<Building>) => onChange(i, { ...b, ...patch });
    const number = (value: string) => value === '' ? null : Number(value);
    const floorsReady = b.daire_sayisi !== null;
    const normal = b.normal_kat ?? 0;
    const assigned = [...(b.bodrumda_daire_yok ? [] : b.bodrum_daireleri), ...(b.giriste_daire_yok ? b.kat_daireleri.slice(1) : b.kat_daireleri)];
    const countField = (label: string, key: 'daire_sayisi' | 'dukkan_sayisi' | 'bodrum_kat' | 'normal_kat', disabled = false) => <div><label htmlFor={`b-${i}-${key}`} className="mb-2 block text-sm font-medium">{label}</label><input id={`b-${i}-${key}`} type="number" min="0" step="1" max={key.endsWith('_kat') ? MAX_FLOORS : undefined} disabled={disabled} value={b[key] ?? ''} onChange={event => {
      const value = number(event.target.value);
      if (key === 'normal_kat' || key === 'bodrum_kat') {
        const length = value !== null && Number.isInteger(value) && value >= 0 && value <= MAX_FLOORS ? value + (key === 'normal_kat' ? 1 : 0) : 0;
        const data = key === 'normal_kat' ? b.kat_daireleri : b.bodrum_daireleri;
        if (data.slice(length).some(item => item !== null) && !window.confirm('Kaldırılan katlara ait daire bilgileri silinecek. Devam edilsin mi?')) return;
        set(key === 'normal_kat' ? { normal_kat: value, kat_daireleri: Array.from({ length }, (_, index) => data[index] ?? null) } : { bodrum_kat: value, bodrum_daireleri: Array.from({ length }, (_, index) => data[index] ?? null) });
      } else if (key === 'daire_sayisi' && value === null) {
        if ((b.bodrum_kat !== null || b.normal_kat !== null) && !window.confirm('Daire sayısı silinirse kat bilgileri de silinecek. Devam edilsin mi?')) return;
        set({ daire_sayisi: null, bodrum_kat: null, normal_kat: null, kat_daireleri: [], bodrum_daireleri: [], esit_dagilim: false });
      }
      else set({ [key]: value });
    }} className={input} /></div>;
    return <fieldset key={i} className="rounded-xl border border-[#dce8e3] bg-[#f8fbf9] p-4 sm:p-5"><legend className="px-2 text-sm font-semibold text-[#27685a]">{i + 1}. Bina</legend><div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2"><label htmlFor={`b-${i}-ad`} className="mb-2 block text-sm font-medium">Bina Adı</label><input id={`b-${i}-ad`} type="text" maxLength={100} value={b.ad} onChange={event => set({ ad: event.target.value })} className={input} /><p className="mt-1 text-xs text-[#81928d]">Örn: A Blok</p></div>
      {countField('Mevcut Daire Sayısı', 'daire_sayisi')}{countField('Mevcut Dükkan Sayısı', 'dukkan_sayisi')}
      <p className="sm:col-span-2 rounded-lg bg-[#eaf3ef] px-3 py-2 text-sm">Toplam Bağımsız Bölüm Sayısı: <strong>{b.daire_sayisi === null && b.dukkan_sayisi === null ? '—' : (b.daire_sayisi ?? 0) + (b.dukkan_sayisi ?? 0)}</strong></p>
      {countField('Bodrum Kat Sayısı', 'bodrum_kat', !floorsReady)}{countField('Normal Kat Sayısı', 'normal_kat', !floorsReady)}
      <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={b.giriste_daire_yok} onChange={event => set({ giriste_daire_yok: event.target.checked })} /> Giriş katta daire yok</label>
      {b.bodrum_kat !== null && <label className="sm:col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={b.bodrumda_daire_yok} onChange={event => set({ bodrumda_daire_yok: event.target.checked })} /> Bodrumda daire yok</label>}
      {!floorsReady && <p className="sm:col-span-2 text-xs text-[#788986]">Kat bilgilerini girmek için önce daire sayısını yazın.</p>}
      <p className="sm:col-span-2 rounded-lg bg-[#eaf3ef] px-3 py-2 text-sm">Toplam Kat Sayısı: <strong>{b.bodrum_kat === null && b.normal_kat === null ? '—' : (b.bodrum_kat ?? 0) + normal + 1}</strong></p>
    </div>
    {floorsReady && b.bodrum_kat !== null && b.normal_kat !== null && (normal + (b.bodrum_kat ?? 0) + 1) > 0 && <div className="mt-5 border-t border-[#dce8e3] pt-4"><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" checked={b.esit_dagilim} onChange={event => set({ esit_dagilim: event.target.checked })} /> Daire sayısı her katta eşit</label>{b.esit_dagilim ? <p className="mt-3 text-sm text-[#52776d]">{(() => { const count = normal + (b.giriste_daire_yok ? 0 : 1) + (b.bodrumda_daire_yok ? 0 : (b.bodrum_kat ?? 0)); return count && b.daire_sayisi! % count === 0 ? `Her seçili katta ${b.daire_sayisi! / count} daire` : 'Daire sayısı katlara eşit ve tam sayı olarak bölünemiyor.'; })()}</p> : <div className="mt-4 grid gap-3 sm:grid-cols-2">{[...(!b.bodrumda_daire_yok ? Array.from({length: b.bodrum_kat ?? 0}, (_, index) => ({ index: (b.bodrum_kat ?? 0) - index - 1, basement: true })) : []), ...Array.from({length: normal + 1}, (_, index) => ({index, basement: false})).filter(f => !b.giriste_daire_yok || f.index !== 0)].map(({index, basement}) => <div key={`${basement}-${index}`}><label htmlFor={`b-${i}-${basement}-${index}`} className="mb-1 block text-xs font-medium text-[#526f67]">{basement ? `${index + 1}. Bodrum Kat` : index === 0 ? 'Zemin Kat' : `${index}. Kat`}</label><input id={`b-${i}-${basement}-${index}`} type="number" min="0" step="1" value={(basement ? b.bodrum_daireleri : b.kat_daireleri)[index] ?? ''} onChange={event => { const next = [...(basement ? b.bodrum_daireleri : b.kat_daireleri)]; next[index] = number(event.target.value); set(basement ? {bodrum_daireleri: next} : {kat_daireleri: next}); }} className={input} /></div>)}</div>}</div>}
    {b.daire_sayisi !== null && b.bodrum_kat !== null && b.normal_kat !== null && <p className="mt-4 text-sm">Girilen daire toplamı: <strong>{b.esit_dagilim && !distributionError(b) ? b.daire_sayisi : b.esit_dagilim ? '—' : assigned.reduce<number>((sum, value) => sum + (value ?? 0), 0)}</strong> / {b.daire_sayisi}{distributionError(b) && <span role="alert" className="mt-2 block text-red-700">{distributionError(b)}</span>}</p>}
    </fieldset>;
  })}</div>;
}
