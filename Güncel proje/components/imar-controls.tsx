'use client';

import { useState, type ReactNode } from 'react';
import { ruleLabels, type RuleSettings, type locksFor } from '@/lib/imarRules';
import type { Scenario } from '@/lib/scenario';
import { defaultHeading, MAX_SECTION_AREA, MAX_SECTION_COLUMNS, MAX_SECTION_FLOORS, MAX_SECTION_HEADING_LENGTH, type BuildingDesign, type SectionFloor } from '@/lib/simulator';

type Lock = { disabled: boolean; reason: string };
type Locks = ReturnType<typeof locksFor>;
const inputClass = 'w-full rounded-lg border border-[#cfddd7] bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-[#216a5e]';
const areaFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

export const useLabels = { residential: 'Konut', 'ground-commercial': 'Zemin Ticaret + Üstü Konut', mixed: 'Ticaret + Konut (Karma)', commercial: 'Tamamen Ticaret' } as const;
export const orderLabels = { detached: 'Ayrık Nizam', attached: 'Bitişik Nizam', block: 'Blok / İkiz' } as const;
export const regimeLabels = { kaks: 'KAKS Esaslı', taks: 'TAKS × Kat Adedi', block: 'Blok Ebatı' } as const;
export const projectionLabels = { none: 'Çıkma Yok', open: 'Açık Çıkma', closed: 'Kapalı Çıkma', mixed: 'Açık + Kapalı Karma', column: 'Kolonlu Arka/Ön Genişleme' } as const;
const roofUsageOptions = { cold: ruleLabels.roofUsage.cold, duplex: ruleLabels.roofUsage.duplex, independent: ruleLabels.roofUsage.independent };
export const geologyLabels = { standard: 'Standart', oa1: 'OA1 · 4–5 kat senaryosu', oa2: 'OA2 · 2 kat senaryosu', 'oa3-5': 'OA3–OA5 · 3 kat senaryosu', je: 'JE / Afete Maruz' } as const;

export function getParameterRows(rules: RuleSettings, scenario: Scenario, design: BuildingDesign): [string, string][] {
  const selected = [scenario.narrow && 'Dar arsa', scenario.heightLimit && 'YENÇOK', rules.flood && 'Taşkın', rules.infrastructure && 'Koruma bandı', rules.solidFuel && 'Katı yakıt', rules.isolation && 'Deprem yalıtım katı'].filter(Boolean).join(', ');
  return [
    ['Kullanım fonksiyonu', useLabels[rules.use]],
    ['Bina kurgusu', `${design.normalFloors} normal kat · ${design.ground ? 'Zemin var' : 'Zemin yok'} · ${design.columns} sütun`],
    ['Yapı nizamı', orderLabels[rules.order]],
    ['İmar rejimi', regimeLabels[rules.regime]],
    ['Çıkma tipi', projectionLabels[rules.projection]],
    ['Çatı şekli', ruleLabels.roofShape[rules.roofShape]],
    ['Çatı kullanımı', ruleLabels.roofUsage[rules.roofUsage]],
    ['Zemin kurgusu', [`Subasman +${areaFormat.format(rules.subasman)} m`, rules.noGroundResidence && 'Konut yok', rules.mezzanine && 'Asma kat', rules.portico && 'Portik'].filter(Boolean).join(' · ')],
    ['Bodrum / eğim', [`${design.basementFloors} bodrum`, scenario.slope ? `Eğimli · ${scenario.exposedFloors ?? 0} kat açıkta` : 'Düz arazi', rules.stepped && 'Kademeli', design.serviceBasement && design.basementFloors > 0 && 'Tek parça alt bodrum'].filter(Boolean).join(' · ')],
    ['Jeoloji ve özel kısıtlar', [geologyLabels[rules.geology], selected].filter(Boolean).join(' · ')],
  ];
}

function Group({ title, initiallyOpen = false, children }: { title: string; initiallyOpen?: boolean; children: ReactNode }) {
  return <details open={initiallyOpen || undefined} className="rounded-xl border border-[#e0e9e4]">
    <summary className="cursor-pointer rounded-xl bg-[#f6f9f7] px-3 py-3 text-sm font-semibold text-[#174b48]">{title}</summary>
    <div className="space-y-3 px-3 py-3">{children}</div>
  </details>;
}

export function Check({ checked, onChange, children, lock }: {
  checked: boolean | undefined;
  onChange: (value: boolean) => void;
  children: ReactNode;
  lock?: Lock;
}) {
  return <div>
    <label className="flex items-start gap-2.5 py-1 text-sm leading-5" title={lock?.disabled ? lock.reason : undefined}>
      <input type="checkbox" checked={checked ?? false} disabled={lock?.disabled} onChange={event => onChange(event.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#216a5e]" />
      <span>{children}{lock?.disabled && <span aria-hidden="true"> 🔒</span>}</span>
    </label>
    {lock?.disabled && <p className="pl-6 text-xs leading-4 text-[#536c64]">{lock.reason}</p>}
  </div>;
}

function Choice<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: Record<T, string>; onChange: (value: T) => void;
}) {
  return <label className="block text-sm font-medium">{label}
    <select value={value} onChange={event => onChange(event.target.value as T)} className={`mt-1.5 ${inputClass}`}>
      {(Object.entries(options) as [T, string][]).map(([key, text]) => <option key={key} value={key}>{text}</option>)}
    </select>
  </label>;
}

function Radios<T extends string>({ label, name, value, options, onChange, locks }: {
  label: string; name: string; value: T; options: Record<T, string>; onChange: (value: T) => void; locks?: Partial<Record<T, Lock>>;
}) {
  return <fieldset className="space-y-2">
    <legend className="mb-2 text-sm font-medium">{label}</legend>
    {(Object.entries(options) as [T, string][]).map(([key, text]) => {
      const lock = locks?.[key];
      return <div key={key}>
        <label className="flex items-start gap-2 text-sm" title={lock?.disabled ? lock.reason : undefined}>
          <input name={name} type="radio" checked={value === key} disabled={lock?.disabled} onChange={() => onChange(key)} className="mt-1 accent-[#216a5e]" />
          <span>{text}{lock?.disabled && <span aria-hidden="true"> 🔒</span>}</span>
        </label>
        {lock?.disabled && <p className="pl-5 text-xs leading-4 text-[#536c64]">{lock.reason}</p>}
      </div>;
    })}
  </fieldset>;
}

function NumberField({ label, value, min = 0, max = 100, step = 1, optional = false, onChange }: {
  label: string; value: number | null | undefined; min?: number; max?: number; step?: number | 'any'; optional?: boolean; onChange: (value: number | null) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return <label className="block text-sm font-medium">{label}
    <input type="number" min={min} max={max} step={step} value={draft ?? value ?? ''} onChange={event => {
      const raw = event.currentTarget.value;
      setDraft(raw);
      if (raw === '' && optional) onChange(null);
      if (raw !== '' && event.currentTarget.validity.valid) onChange(Number(raw));
    }} onBlur={() => setDraft(null)} className={`mt-1.5 ${inputClass}`} />
  </label>;
}

export function ImarControls({ design, scenario, rules, locks, floors, busy, updateDesign, updateScenario, updateRules, setContractorFloor }: {
  design: BuildingDesign;
  scenario: Scenario;
  rules: RuleSettings;
  locks: Locks;
  floors: SectionFloor[];
  busy: boolean;
  updateDesign: (patch: Partial<BuildingDesign>) => void;
  updateScenario: (patch: Partial<Scenario>) => void;
  updateRules: (patch: Partial<RuleSettings>) => void;
  setContractorFloor: (id: string, checked: boolean) => void;
}) {
  return <fieldset disabled={busy} className="space-y-3">
    <Group title="Temel Bina & Kullanım Fonksiyonu" initiallyOpen>
      <Choice label="Kullanım fonksiyonu" value={rules.use} options={useLabels} onChange={use => updateRules({ use })} />
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Normal Kat Sayısı" value={design.normalFloors} max={MAX_SECTION_FLOORS} onChange={value => updateDesign({ normalFloors: value ?? 0 })} />
        <NumberField label="Bodrum Kat Sayısı" value={design.basementFloors} max={MAX_SECTION_FLOORS} onChange={value => updateDesign({ basementFloors: value ?? 0 })} />
      </div>
      <Check checked={design.ground} onChange={ground => updateDesign({ ground })}>Zemin Kat Var mı?</Check>
      <NumberField label="Kattaki Sütun (Daire) Sayısı" value={design.columns} min={1} max={MAX_SECTION_COLUMNS} onChange={value => updateDesign({ columns: value ?? 1 })} />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: design.columns }, (_, index) => <label key={index} className="text-xs text-[#536c64]">{index + 1}. Cephe Başlığı
          <input type="text" maxLength={MAX_SECTION_HEADING_LENGTH} value={design.headings[index] ?? ''} placeholder={defaultHeading(index)} onChange={event => {
            const headings = Array.from({ length: Math.max(design.headings.length, design.columns) }, (_, i) => i === index ? event.target.value : design.headings[i] ?? '');
            updateDesign({ headings });
          }} className={`mt-1 ${inputClass}`} />
        </label>)}
      </div>
      <fieldset className="rounded-lg border border-[#e3ebe7] p-3">
        <legend className="px-1 text-sm font-semibold">Müteahhite Kalan Katlar</legend>
        <div className="max-h-36 overflow-y-auto">
          {floors.map(floor => <Check key={floor.id} checked={design.contractorFloors.includes(floor.id)} onChange={checked => setContractorFloor(floor.id, checked)}>{floor.label}</Check>)}
          {floors.length === 0 && <p className="text-xs text-[#536c64]">Bağımsız bölümü olan katlar burada görünür.</p>}
        </div>
      </fieldset>
    </Group>
    <Group title="Yapı Nizamı & Bahçe">
      <Choice label="Yapı nizamı" value={rules.order} options={orderLabels} onChange={order => updateRules({ order })} />
      <Check checked={rules.frontGarden} onChange={frontGarden => updateRules({ frontGarden })}>Ön bahçe var</Check>
      <Check checked={rules.sideGarden} lock={locks.sideGarden} onChange={sideGarden => updateRules({ sideGarden })}>Yan bahçe var</Check>
      <Check checked={rules.rearGarden} onChange={rearGarden => updateRules({ rearGarden })}>Arka bahçe var</Check>
      <Check checked={rules.sideProjection} lock={locks.sideProjection} onChange={sideProjection => updateRules({ sideProjection })}>Yan cephede çıkma</Check>
    </Group>
    <Group title="İmar Hesap Rejimi">
      <Choice label="İmar hesabı" value={rules.regime} options={regimeLabels} onChange={regime => updateRules({ regime })} />
      {rules.regime === 'block' && <div className="grid grid-cols-2 gap-2">
        <NumberField label="Blok eni (m)" value={rules.blockWidth} optional step="any" max={10000} onChange={blockWidth => updateRules({ blockWidth })} />
        <NumberField label="Blok boyu (m)" value={rules.blockDepth} optional step="any" max={10000} onChange={blockDepth => updateRules({ blockDepth })} />
      </div>}
      <Check checked={scenario.bonus} onChange={bonus => updateScenario({ bonus })}>%30 Emsal Harici Bonus</Check>
      <Check checked={rules.isolation} onChange={isolation => updateRules({ isolation })}>Deprem Yalıtım Katı (≤ 2,40 m)</Check>
      <NumberField label="Beyan edilen gömülü ve teknik alan (m²)" value={rules.totalBuriedTechnicalArea} optional step="any" max={1000000000} onChange={totalBuriedTechnicalArea => updateRules({ totalBuriedTechnicalArea })} />
    </Group>
    <Group title="Zemin Kat Kurgusu">
      <NumberField label="Subasman kotu (m)" value={rules.subasman} step="any" max={1.2} onChange={value => updateRules({ subasman: value ?? 0 })} />
      <Check checked={rules.mezzanine} lock={locks.mezzanine} onChange={mezzanine => updateRules({ mezzanine })}>Asma Katlı Zemin</Check>
      <Check checked={rules.portico} lock={locks.portico} onChange={portico => updateRules({ portico })}>Portik (Bina Altı Geçit)</Check>
      <Check checked={rules.noGroundResidence} onChange={noGroundResidence => updateRules({ noGroundResidence })}>Zeminde Daire Yok (Dükkan/Lobi)</Check>
    </Group>
    <Group title="Bodrum & Arazi Eğimi">
      <Radios label="Arazi durumu" name="terrain" value={scenario.slope ? 'slope' : 'level'} options={{ level: 'Düz Arazi', slope: 'Eğim / Kot Farkı' }} onChange={terrain => updateScenario({ slope: terrain === 'slope' })} />
      {scenario.slope && <>
        <NumberField label="Kaç kat açığa çıkıyor?" value={scenario.exposedFloors} optional onChange={exposedFloors => updateScenario({ exposedFloors })} />
        <NumberField label="Arazide kot farkı (m)" value={rules.siteElevationDelta} optional step="any" onChange={siteElevationDelta => updateRules({ siteElevationDelta })} />
        <Check checked={rules.stepped} onChange={stepped => updateRules({ stepped })}>Kademeli Bina (&gt; 3,50 m kot farkı)</Check>
      </>}
      <Check checked={design.serviceBasement} onChange={serviceBasement => updateDesign({ serviceBasement })}>En Alt Bodrum Tek Parça Otopark/Sığınak Olsun</Check>
      <Check checked={rules.basementOpenings} lock={locks.basementOpenings} onChange={basementOpenings => updateRules({ basementOpenings })}>Bodrum kapı / pencere açıklıkları</Check>
      <Check checked={rules.basementParking} lock={locks.basementParking} onChange={basementParking => updateRules({ basementParking })}>Bodrum otopark girişi</Check>
    </Group>
    <Group title="Çıkma (Cumba / Balkon)">
      <Radios label="Çıkma tipi" name="projection" options={projectionLabels} value={rules.projection} onChange={projection => updateRules({ projection })} locks={{ closed: locks.projectionClosed, mixed: locks.projectionMixed, column: locks.projectionColumn }} />
      {rules.projection === 'column' && <p className="text-xs text-[#536c64]">Duvarla kapatmadan ve 1 m sınırını aşmadan tasarlayın.</p>}
    </Group>
    <Group title="Çatı, Son Kat & Özel Kısıtlar">
      <Radios label="Çatı Şekli" name="roof-shape" options={ruleLabels.roofShape} value={rules.roofShape} onChange={roofShape => updateRules({ roofShape })} />
      {!locks.roofUsage.disabled && <Radios label="Çatı Kullanımı" name="roof-usage" options={roofUsageOptions} value={rules.roofUsage === 'none' ? 'cold' : rules.roofUsage} onChange={roofUsage => updateRules({ roofUsage })} locks={{ duplex: locks.roofDuplex, independent: locks.roofIndependent }} />}
      {rules.roofUsage === 'duplex' && <NumberField label="Çatı Piyesi Toplam Brüt Alanı (m²)" value={design.floorAreas.roof ?? null} optional step="any" max={MAX_SECTION_AREA} onChange={area => {
        const floorAreas = { ...design.floorAreas };
        if (area === null) delete floorAreas.roof;
        else floorAreas.roof = area;
        updateDesign({ floorAreas });
      }} />}
      <Choice label="Jeolojik bölge" value={rules.geology} options={geologyLabels} onChange={geology => updateRules({ geology })} />
      <Check checked={scenario.narrow} onChange={narrow => updateScenario({ narrow })}>Dar Arsa / Çekme Mesafesi Kısıtı</Check>
      <Check checked={scenario.heightLimit} onChange={heightLimit => updateScenario({ heightLimit })}>YENÇOK (Maksimum Yükseklik) Sınırı</Check>
      <Check checked={rules.flood} onChange={flood => updateRules({ flood })}>Su Taşkın Alanı</Check>
      {rules.flood && <div className="grid grid-cols-2 gap-2">
        <NumberField label="Kret kotu (m)" value={rules.floodCrest} min={-10000} max={10000} step="any" optional onChange={floodCrest => updateRules({ floodCrest })} />
        <NumberField label="En düşük iskân / açıklık / giriş kotu (m)" value={rules.basementOpeningElevation} min={-10000} max={10000} step="any" optional onChange={basementOpeningElevation => updateRules({ basementOpeningElevation })} />
      </div>}
      <Check checked={rules.infrastructure} onChange={infrastructure => updateRules({ infrastructure })}>BOTAŞ / İSKİ / TEİAŞ Koruma Bandı</Check>
      <Check checked={rules.solidFuel} onChange={solidFuel => updateRules({ solidFuel })}>Katı Yakıtlı Isıtma</Check>
    </Group>
  </fieldset>;
}
