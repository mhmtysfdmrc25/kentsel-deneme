'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useProjects } from '@/components/project-context';
import { SectionSheet } from '@/components/section-sheet';
import { emptyScenario, type Scenario } from '@/lib/scenario';
import {
  defaultHeading, deriveSection, emptyDesign, MAX_SECTION_AREA, MAX_SECTION_COLUMNS,
  MAX_SECTION_FLOORS, MAX_SECTION_HEADING_LENGTH, MAX_SECTION_TITLE_LENGTH, validateSimulator,
  type BuildingDesign, type SectionFloor, type SectionUnit, type SimulatorScenario, type UnitOverride,
} from '@/lib/simulator';
import type { Project } from '@/lib/projects';

const inputClass = 'w-full rounded-lg border border-[#cfddd7] bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-[#216a5e]';
const actionClass = 'rounded-lg bg-[#174b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#216a5e] disabled:opacity-50';
const squareMetres = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const areaText = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : `${squareMetres.format(value)} m²`;

function Check({ checked, onChange, children }: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return <label className="flex items-start gap-2.5 py-1 text-sm leading-5">
    <input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#216a5e]" />
    <span>{children}</span>
  </label>;
}

function Count({ label, value, min = 0, max, optional = false, onChange }: {
  label: string;
  value: number | null;
  min?: number;
  max: number;
  optional?: boolean;
  onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="block text-sm font-medium">
    {label}
    <input
      type="number"
      min={min}
      max={max}
      step="1"
      value={draft ?? value ?? ''}
      onChange={event => {
        const raw = event.currentTarget.value;
        setDraft(raw);
        if (raw === '' && optional) onChange(null);
        if (raw !== '' && event.currentTarget.validity.valid) onChange(Number(raw));
      }}
      onBlur={() => setDraft(null)}
      className={`mt-1.5 ${inputClass}`}
    />
  </label>;
}

type Editing = { floor: SectionFloor; unit?: SectionUnit };

function SectionEditor({ editing, override, floorOverride, serviceTitle, onClose, onApply }: {
  editing: Editing;
  override?: UnitOverride;
  floorOverride?: number;
  serviceTitle?: string;
  onClose: () => void;
  onApply: (data: { area?: number; title?: string; type?: SectionUnit['type']; gross?: number; totalGross?: number }) => void;
}) {
  const { unit, floor } = editing;
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState('');
  useEffect(() => { dialog.current?.showModal(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const readArea = (key: string) => {
      const value = String(form.get(key) ?? '');
      return value === '' ? undefined : Number(value);
    };
    const area = readArea('area');
    const gross = readArea('gross');
    onApply(unit ? {
      title: String(form.get('title') ?? '').trim() || undefined,
      type: form.get('type') === unit.type ? override?.type : form.get('type') as SectionUnit['type'],
      gross,
    } : { area, title: floor.service ? String(form.get('title') ?? '').trim() : undefined });
  }

  return <dialog ref={dialog} onClose={onClose} className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-[#dbe5e2] bg-white p-6 text-[#142e32] shadow-xl backdrop:bg-black/40" aria-labelledby="section-editor-title">
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 id="section-editor-title" className="text-lg font-semibold">{unit ? 'Bağımsız Bölümü Düzenle' : 'Kat Alanını Düzenle'}</h3>
        <p className="mt-1 text-sm text-[#536c64]">{floor.label}{unit && ` · ${unit.title}`}</p>
      </div>
      {unit ? <>
        <label className="block text-sm font-medium">Başlık<input name="title" maxLength={MAX_SECTION_TITLE_LENGTH} defaultValue={override?.title ?? ''} placeholder={unit.title} className={`mt-1 ${inputClass}`} /></label>
        <label className="block text-sm font-medium">Tip<select name="type" defaultValue={unit.type} className={`mt-1 ${inputClass}`}>
          <option value="apartment">DAİRE</option><option value="shop">DÜKKAN</option><option value="duplex">DUBLEKS</option>
        </select></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Brüt m²<input name="gross" type="number" min="0" max={MAX_SECTION_AREA} step="any" defaultValue={override?.gross ?? ''} placeholder={areaText(unit.gross)} className={`mt-1 ${inputClass}`} /></label>
          <label className="block text-sm font-medium">Genel Brüt m²<input readOnly value={areaText(unit.totalGross)} className={`mt-1 ${inputClass} bg-[#f2f6f4]`} /></label>
        </div>
      </> : <>{floor.service && <label className="block text-sm font-medium">Başlık<input name="title" maxLength={MAX_SECTION_TITLE_LENGTH} defaultValue={serviceTitle ?? ''} placeholder="OTOPARK / SIĞINAK" className={`mt-1 ${inputClass}`} /></label>}<label className="block text-sm font-medium">Kat toplam inşaat alanı (m²)<input name="area" type="number" min="0" max={MAX_SECTION_AREA} step="any" defaultValue={floorOverride ?? ''} placeholder={areaText(floor.area)} className={`mt-1 ${inputClass}`} /></label></>}
      <p className="text-xs text-[#536c64]">Alanı boş bırakırsan otomatik değer kullanılır.</p>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#cfddd7] px-4 py-2.5 text-sm">Vazgeç</button>
        <button type="submit" className={actionClass}>Uygula</button>
      </div>
    </form>
  </dialog>;
}

export function ScenarioPanel({ project }: { project: Project }) {
  const { refresh } = useProjects();
  const [initial] = useState<SimulatorScenario>(() => {
    try {
      if (project.architectural_scenarios) return validateSimulator(JSON.parse(project.architectural_scenarios));
    } catch {
      return emptyScenario();
    }
    return emptyScenario();
  });
  const [scenario, setScenario] = useState<Scenario>(initial);
  const [design, setDesign] = useState<BuildingDesign>(() => initial.design ?? emptyDesign());
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const section = deriveSection(project, scenario, design);
  const base = typeof project.arsa_alani === 'number' && typeof project.taks === 'number' ? project.arsa_alani * project.taks : null;
  const emsal = typeof project.arsa_alani === 'number' && typeof project.kaks === 'number' ? project.arsa_alani * project.kaks : null;
  const bonus = emsal === null ? null : emsal * (scenario.bonus ? 1.3 : 1);
  const slope = base !== null && scenario.slope && scenario.exposedFloors !== null ? base * scenario.exposedFloors : null;
  const eligibleFloors = section.floors.filter(floor => floor.units.length > 0);
  const riskChecks = [
    { active: (section.totalArea !== null && section.totalArea > 1500) || section.totalUnits > 12, label: 'Bodrumda sığınak gerekliliğini kontrol edin.' },
    { active: section.totalFloors >= 4, label: 'Asansör gerekliliğini kontrol edin.' },
    { active: section.totalFloors >= 10, label: 'İkinci asansör ve yangın merdiveni gerekliliğini kontrol edin.' },
    { active: section.totalUnits > 30, label: 'En az bir kapıcı dairesi gerekip gerekmediğini kontrol edin.' },
  ];

  const clearFeedback = () => { setMessage(''); setError(''); };
  const updateScenario = (patch: Partial<Scenario>) => { setScenario(current => ({ ...current, ...patch })); clearFeedback(); };
  const updateDesign = (patch: Partial<BuildingDesign>) => { setDesign(current => ({ ...current, ...patch })); clearFeedback(); };

  async function save() {
    if (busy) return;
    setBusy(true); clearFeedback();
    try {
      const payload = validateSimulator({ ...scenario, design });
      const result = await fetch(`/api/projects/${project.id}/scenario`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error || 'Senaryo kaydedilemedi.');
      try { await refresh(); setMessage('Senaryo kaydedildi.'); }
      catch { setError('Senaryo kaydedildi. Proje listesi yenilenemedi.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Senaryo kaydedilemedi.'); }
    finally { setBusy(false); }
  }

  return <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(290px,1fr)_minmax(0,2.25fr)]">
    <section className="space-y-6 rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-sm" aria-label="Senaryo ve Yeni Bina Ayarları">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="mb-3 text-lg font-semibold">Yeni Bina Ayarları</legend>
        <div className="grid grid-cols-2 gap-3">
          <Count label="Normal Kat Sayısı" value={design.normalFloors} max={MAX_SECTION_FLOORS} onChange={value => updateDesign({ normalFloors: value ?? 0 })} />
          <Count label="Bodrum Kat Sayısı" value={design.basementFloors} max={MAX_SECTION_FLOORS} onChange={value => updateDesign({ basementFloors: value ?? 0 })} />
        </div>
        <Check checked={design.ground} onChange={ground => updateDesign({ ground })}>Zemin Kat Var mı?</Check>
        <Check checked={design.serviceBasement} onChange={serviceBasement => updateDesign({ serviceBasement })}>En Alt Bodrum Tek Parça Otopark/Sığınak Olsun</Check>
        <Count label="Kattaki Sütun (Daire) Sayısı" value={design.columns} min={1} max={MAX_SECTION_COLUMNS} onChange={value => updateDesign({ columns: value ?? 1 })} />
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: design.columns }, (_, index) => <label key={index} className="text-xs text-[#536c64]">
            {index + 1}. Cephe Başlığı
            <input type="text" maxLength={MAX_SECTION_HEADING_LENGTH} value={design.headings[index] ?? ''} placeholder={defaultHeading(index)} onChange={event => {
              const headings = Array.from({ length: Math.max(design.headings.length, design.columns) }, (_, i) => i === index ? event.target.value : design.headings[i] ?? '');
              updateDesign({ headings });
            }} className={`mt-1 ${inputClass}`} />
          </label>)}
        </div>
        <Check checked={design.duplex} onChange={duplex => updateDesign({ duplex })}>Son Kat Çatı Arası Piyesli Dubleks Olsun</Check>
        {design.duplex && <p className="text-xs text-[#536c64]">{design.normalFloors > 0 ? 'Çatı piyesi alanını metraj tablosundan girebilirsiniz.' : 'Çatı piyesi için en az bir normal kat ekleyin.'}</p>}
        <fieldset className="rounded-xl border border-[#e3ebe7] p-3">
          <legend className="px-1 text-sm font-semibold">Müteahhite Kalan Katlar</legend>
          <div className="max-h-44 overflow-y-auto">
            {eligibleFloors.length ? eligibleFloors.map(floor => <Check key={floor.id} checked={design.contractorFloors.includes(floor.id)} onChange={checked => updateDesign({ contractorFloors: checked ? [...design.contractorFloors, floor.id] : design.contractorFloors.filter(id => id !== floor.id) })}>{floor.label}</Check>) : <p className="text-xs text-[#536c64]">Bağımsız bölümü olan katlar burada görünür.</p>}
          </div>
        </fieldset>
      </fieldset>
      <fieldset disabled={busy} className="space-y-2 border-t border-[#e3ebe7] pt-2">
        <legend className="pr-2 text-base font-semibold">İmar Senaryoları ve Kısıtlar</legend>
        <Check checked={scenario.bonus} onChange={bonus => updateScenario({ bonus })}>%30 Emsal Harici Bonus Kullanılsın mı?</Check>
        <Check checked={scenario.slope} onChange={slope => updateScenario({ slope })}>Arsada Kot Farkı (Eğim) Var mı?</Check>
        {scenario.slope && <Count label="Kaç kat açığa çıkıyor?" value={scenario.exposedFloors} max={100} optional onChange={exposedFloors => updateScenario({ exposedFloors })} />}
        <Check checked={scenario.projection} onChange={projection => updateScenario({ projection })}>Üst Katlarda Çıkma Yapılacak mı?</Check>
        {scenario.projection && <label className="block text-sm font-medium">Çıkma türü<select value={scenario.projectionType} onChange={event => updateScenario({ projectionType: event.target.value as Scenario['projectionType'] })} className={`mt-1.5 ${inputClass}`}><option value="">Seçiniz</option><option value="open">Açık Çıkma (Balkon)</option><option value="closed">Kapalı Çıkma (Odaya Dahil)</option></select></label>}
        <Check checked={scenario.narrow} onChange={narrow => updateScenario({ narrow })}>Dar Arsa / Çekme Mesafesi Kısıtı</Check>
        <Check checked={scenario.heightLimit} onChange={heightLimit => updateScenario({ heightLimit })}>YENÇOK (Maksimum Yükseklik) Sınırı</Check>
      </fieldset>
      <button type="button" onClick={save} disabled={busy} className={actionClass}>{busy ? 'Kaydediliyor…' : 'Senaryoyu Kaydet'}</button>
      {message && <p role="status" className="text-sm text-[#216a5e]">{message}</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>

    <section className="min-w-0 space-y-5" aria-label="Canlı Uyarılar ve Otomatik Şematik Kesit Paftası">
      <div className="rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Canlı Metraj Özeti</h2>
            <p className="mt-1 text-sm text-[#536c64]">Arsa {areaText(typeof project.arsa_alani === 'number' ? project.arsa_alani : null)} · TAKS {project.taks ?? '—'} · KAKS {project.kaks ?? '—'}</p>
          </div>
          <button type="button" disabled={!section.floors.length || Boolean(editing)} onClick={() => window.print()} className={actionClass}>Kesit PDF İndir / Yazdır</button>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-3">
          {([
            ['Net Emsal Alanı', emsal],
            ['Bonuslu Maks. Alan', bonus],
            ['Kot Farkı Bonusu', slope],
          ] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-[#eef5f1] px-3 py-2"><dt className="text-xs text-[#536c64]">{label}</dt><dd className="mt-1 text-lg font-semibold text-[#174b48]">{areaText(value)}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm text-[#536c64]">Yeni bina · {section.totalFloors} kat · {section.totalUnits} bağımsız bölüm · {areaText(section.totalArea)}</p>
        {base === null && emsal === null && <p className="mt-2 text-sm text-[#536c64]">Otomatik kat alanları için Proje Yönetimi’nde arsa alanı ve TAKS veya KAKS girin. Kat alanlarını paftadan elle de girebilirsiniz.</p>}
      </div>

      <div className="space-y-2 rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mevzuat ve Risk Analizi</h2>
        {scenario.narrow && scenario.heightLimit ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"><strong>KRİTİK UYARI:</strong> Hem dar arsa hem yükseklik sınırınız var. İmar hakkınızın (KAKS) tamamını kullanamama (Kayıp Emsal) riskiniz çok yüksek!</p>
          : scenario.narrow ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Taban oturumunuz daralabilir, emsali doldurmak için kat sayısını artırmanız gerekebilir.</p>
          : scenario.heightLimit ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">Kat sınırınız var, emsali doldurmak için taban oturumunu (TAKS) maksimumda kullanmalısınız.</p> : null}
        {riskChecks.filter(check => check.active).map(check => <p key={check.label} className="rounded-lg bg-amber-50 p-3 text-sm text-amber-950">{check.label}</p>)}
        <p className="text-xs leading-5 text-[#536c64]">Uyarılar yeni bina taslağındaki eşiklere bağlı ön kontrollerdir. Ruhsat, emsal dışı alan, kot ve çıkma koşulları için ilgili mevzuat ve belediye plan notları ayrıca değerlendirilir.</p>
      </div>

      <SectionSheet project={project} design={design} section={section} onUnit={busy ? undefined : (unit, floor) => setEditing({ unit, floor })} onFloor={busy ? undefined : floor => setEditing({ floor })} />
      <SectionSheet project={project} design={design} section={section} print />
    </section>

    {editing && <SectionEditor editing={editing} override={editing.unit ? design.units[editing.unit.id] : undefined} floorOverride={design.floorAreas[editing.floor.id]} serviceTitle={design.serviceTitle} onClose={() => setEditing(null)} onApply={({ area, ...unitData }) => {
      if (editing.unit) updateDesign({ units: { ...design.units, [editing.unit.id]: unitData } });
      else {
        const floorAreas = { ...design.floorAreas };
        if (area === undefined) delete floorAreas[editing.floor.id];
        else floorAreas[editing.floor.id] = area;
        updateDesign({ floorAreas, ...(editing.floor.service ? { serviceTitle: unitData.title || undefined } : {}) });
      }
      setEditing(null);
    }} />}
  </div>;
}
