'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, getParameterRows, ImarControls } from '@/components/imar-controls';
import { useProjects } from '@/components/project-context';
import { SectionSheet } from '@/components/section-sheet';
import { DEFAULT_RULE_SETTINGS, evaluateImarRules, normalizeRuleSettings, type RuleSettings } from '@/lib/imarRules';
import { emptyScenario, type Scenario } from '@/lib/scenario';
import {
  deriveSection, emptyDesign, isShareableUnit, MAX_SECTION_AREA, MAX_SECTION_TITLE_LENGTH, validateSimulator,
  type BuildingDesign, type SectionFloor, type SectionUnit, type SimulatorScenario, type UnitOverride,
} from '@/lib/simulator';
import type { Project } from '@/lib/projects';

const inputClass = 'w-full rounded-lg border border-[#cfddd7] bg-white px-3 py-2 text-sm focus:outline-2 focus:outline-[#216a5e]';
const actionClass = 'rounded-lg bg-[#174b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#216a5e] disabled:opacity-50';
const sqm = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });
const areaText = (value: number | null) => value === null || !Number.isFinite(value) ? '—' : `${sqm.format(value)} m²`;
const unitLabels: Record<SectionUnit['type'], string> = { apartment: 'DAİRE', shop: 'DÜKKAN', duplex: 'DUBLEKS', storage: 'DEPO', parking: 'OTOPARK/SIĞINAK' };
type Editing = { floor: SectionFloor; unit?: SectionUnit };
type EditResult = { area?: number; title?: string; unit?: UnitOverride };

function SectionEditor({ editing, override, floorOverride, serviceTitle, floorSelected, residenceLockReason, onClose, onApply }: {
  editing: Editing;
  override?: UnitOverride;
  floorOverride?: number;
  serviceTitle?: string;
  floorSelected: boolean;
  residenceLockReason?: string;
  onClose: () => void;
  onApply: (data: EditResult) => void;
}) {
  const { unit, floor } = editing;
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState(unit?.type ?? 'apartment');
  const [share, setShare] = useState(unit && isShareableUnit(unit.type) ? unit.isContractorShare : floorSelected);
  useEffect(() => { dialog.current?.showModal(); }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const text = (key: string) => String(form.get(key) ?? '').trim();
    const number = (key: string) => text(key) === '' ? undefined : Number(text(key));
    if (unit) {
      const allowed = unit.allowedTypes ?? ['apartment', 'shop', 'duplex'];
      if (!allowed.includes(type)) return;
      onApply({ unit: {
        ...override,
        title: text('title') || undefined,
        type: type === unit.type ? override?.type : type,
        gross: number('gross'),
        isContractorShare: isShareableUnit(type) && share !== floorSelected ? share : undefined,
      } });
    } else onApply({ area: number('area'), title: floor.service ? text('title') : undefined });
  }

  const allowed = unit?.allowedTypes ?? ['apartment', 'shop', 'duplex'];
  return <dialog ref={dialog} onClose={onClose} className="m-auto w-[min(92vw,28rem)] rounded-2xl border border-[#dbe5e2] bg-white p-6 text-[#142e32] shadow-xl backdrop:bg-black/40" aria-labelledby="section-editor-title">
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h3 id="section-editor-title" className="text-lg font-semibold">{unit ? 'Bağımsız Bölümü Düzenle' : 'Kat Alanını Düzenle'}</h3>
        <p className="mt-1 text-sm text-[#536c64]">{floor.label}{unit && ` · ${unit.title}`}</p>
      </div>
      {unit ? <>
        <label className="block text-sm font-medium">Başlık<input name="title" maxLength={MAX_SECTION_TITLE_LENGTH} defaultValue={override?.title ?? ''} placeholder={unit.title} className={`mt-1 ${inputClass}`} /></label>
        <label className="block text-sm font-medium">Tip<select name="type" value={type} onChange={event => setType(event.target.value as SectionUnit['type'])} className={`mt-1 ${inputClass}`}>
          {(Object.keys(unitLabels) as SectionUnit['type'][]).map(type => <option key={type} value={type} disabled={!allowed.includes(type)}>{unitLabels[type]}</option>)}
        </select></label>
        {!allowed.includes('apartment') && residenceLockReason && (
          <p className="text-xs text-[#536c64]"><span aria-hidden="true">🔒 </span>{residenceLockReason}</p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">{unit.roofArrow ? 'Piyes Hariç Brüt m²' : 'Brüt m²'}<input name="gross" type="number" min="0" max={MAX_SECTION_AREA} step="any" defaultValue={override?.gross ?? ''} placeholder={areaText(unit.gross === null ? null : unit.gross - (unit.roofArea ?? 0))} className={`mt-1 ${inputClass}`} /></label>
          <label className="block text-sm font-medium">Genel Brüt m²<input readOnly value={areaText(unit.totalGross)} className={`mt-1 ${inputClass} bg-[#f2f6f4]`} /></label>
        </div>
        {isShareableUnit(type) && <Check checked={share} onChange={setShare}>Müteahhit Payı (Taralı Göster)</Check>}
      </> : <>
        {floor.service && <label className="block text-sm font-medium">Başlık<input name="title" maxLength={MAX_SECTION_TITLE_LENGTH} defaultValue={serviceTitle ?? ''} placeholder="OTOPARK / SIĞINAK" className={`mt-1 ${inputClass}`} /></label>}
        <label className="block text-sm font-medium">{floor.kind === 'roof' ? 'Varsayılan çatı katı alanı (m²)' : 'Kat toplam inşaat alanı (m²)'}<input name="area" type="number" min="0" max={MAX_SECTION_AREA} step="any" defaultValue={floorOverride ?? ''} placeholder={areaText(floor.area)} className={`mt-1 ${inputClass}`} /></label>
        {floor.kind === 'roof' && <p className="text-xs text-[#536c64]">Bu alan, kendi brüt alanı girilmemiş dairelerin varsayılanını belirler.</p>}
      </>}
      <p className="text-xs text-[#536c64]">Alanı boş bırakırsan otomatik değer kullanılır.</p>
      <div className="flex justify-end gap-3">
        <button type="button" onClick={onClose} className="rounded-lg border border-[#cfddd7] px-4 py-2.5 text-sm">Vazgeç</button>
        <button type="submit" className={actionClass}>Uygula</button>
      </div>
    </form>
  </dialog>;
}

function load(project: Project): SimulatorScenario {
  try {
    if (project.architectural_scenarios) return validateSimulator(JSON.parse(project.architectural_scenarios));
  } catch {
    // Önceki veya eksik bir kayıtla yeni bir taslak açılabilir.
  }
  return emptyScenario();
}

function initialDesign(project: Project, scenario: SimulatorScenario): BuildingDesign {
  const design = scenario.design ?? emptyDesign();
  const rules = design.rules ?? {
    ...DEFAULT_RULE_SETTINGS,
    roofUsage: design.duplex ? 'duplex' as const : DEFAULT_RULE_SETTINGS.roofUsage,
    projection: scenario.projection ? (scenario.projectionType === 'closed' ? 'closed' as const : 'open' as const) : 'none' as const,
  };
  return { ...design, rules: normalizeRuleSettings(project, design, rules, scenario) };
}

export function ScenarioPanel({ project }: { project: Project }) {
  const { refresh } = useProjects();
  const [initial] = useState(() => load(project));
  const [scenario, setScenario] = useState<Scenario>(initial);
  const [design, setDesign] = useState<BuildingDesign>(() => initialDesign(project, initial));
  const [editing, setEditing] = useState<Editing | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [includeNotes, setIncludeNotes] = useState(true);
  const rules = design.rules ?? DEFAULT_RULE_SETTINGS;
  const section = deriveSection(project, scenario, design);
  const evaluation = evaluateImarRules(project, design, section, rules, scenario);
  const { calculations, legalNotes, locks } = evaluation;
  const residenceLock = editing?.floor.kind === 'basement'
    ? (editing.floor.id === 'basement-1' ? locks.basement1Residence : locks.basement2Residence)
    : editing?.floor.kind === 'ground' ? locks.groundResidence : locks.commercialUpperResidence;
  const report = { settings: rules, evaluation, parameters: getParameterRows(rules, scenario, design) };
  const floors = section.floors.filter(floor => floor.units.some(unit => isShareableUnit(unit.type)));
  const categories = [...new Set(legalNotes.map(note => note.category))];

  const clearFeedback = () => { setMessage(''); setError(''); };

  function update(nextDesign: BuildingDesign, nextScenario = scenario) {
    setDesign({ ...nextDesign, rules: normalizeRuleSettings(project, nextDesign, nextDesign.rules ?? rules, nextScenario) });
    setScenario(nextScenario);
    clearFeedback();
  }

  const updateDesign = (patch: Partial<BuildingDesign>) => update({ ...design, ...patch });
  const updateRules = (patch: Partial<RuleSettings>) => updateDesign({ rules: { ...rules, ...patch } });
  const updateScenario = (patch: Partial<Scenario>) => update(design, { ...scenario, ...patch });

  function setContractorFloor(id: string, checked: boolean) {
    const units = { ...design.units };
    for (const unitId of Object.keys(units)) {
      if (!unitId.startsWith(`${id}:`)) continue;
      units[unitId] = { ...units[unitId], isContractorShare: undefined };
    }
    updateDesign({
      units,
      contractorFloors: checked ? [...new Set([...design.contractorFloors, id])] : design.contractorFloors.filter(floor => floor !== id),
    });
  }

  async function save() {
    if (busy) return;
    setBusy(true);
    clearFeedback();
    try {
      const payload = validateSimulator({
        ...scenario,
        projection: rules.projection !== 'none',
        projectionType: rules.projection === 'closed' || rules.projection === 'mixed' ? 'closed' : rules.projection === 'none' ? '' : 'open',
        design: { ...design, duplex: rules.roofUsage === 'duplex' },
      });
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

  function applyEdit(data: EditResult) {
    if (!editing) return;
    if (editing.unit && data.unit) {
      updateDesign({ units: { ...design.units, [editing.unit.id]: data.unit } });
    } else {
      const floorAreas = { ...design.floorAreas };
      if (data.area === undefined) delete floorAreas[editing.floor.id];
      else floorAreas[editing.floor.id] = data.area;
      updateDesign({ floorAreas, ...(editing.floor.service ? { serviceTitle: data.title || undefined } : {}) });
    }
    setEditing(null);
  }

  return <div className="mt-8 grid items-start gap-6 xl:grid-cols-[minmax(290px,1fr)_minmax(0,2.25fr)]">
    <section className="space-y-5 rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-sm" aria-label="Senaryo ve Yeni Bina Ayarları">
      <ImarControls design={design} scenario={scenario} rules={rules} locks={locks} floors={floors} busy={busy} updateDesign={updateDesign} updateScenario={updateScenario} updateRules={updateRules} setContractorFloor={setContractorFloor} />
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
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <button type="button" disabled={!section.floors.length || Boolean(editing)} onClick={() => window.print()} className={actionClass}>Kesit PDF İndir / Yazdır</button>
            <Check checked={includeNotes} onChange={setIncludeNotes}>2. Sayfa Mevzuat &amp; Senaryo Notlarını PDF&apos;e Dahil Et</Check>
          </div>
        </div>
        <dl className="mt-4 grid gap-2 sm:grid-cols-3">
          {([
            ['Net Emsal Alanı', areaText(calculations.netEmsal)],
            ['%30 Emsal Harici Havuzu', areaText(calculations.bonusPool)],
            ['Senaryo Rejimine Göre Alan', areaText(calculations.regimeArea)],
            ['Tahmini Gömülü / Teknik Alan', areaText(calculations.buriedTechnicalArea)],
            ['Beyan Edilen Gömülü / Teknik Alan', areaText(calculations.exemptArea)],
            ['Kot Farkı Alan Tahmini', areaText(calculations.slopeArea)],
            ['Yan / Arka Bahçe Artışı', calculations.setbackIncrease === null ? '—' : `${sqm.format(calculations.setbackIncrease)} m`],
            ['Tahmini Ağaç Adedi', calculations.treeCount === null ? '—' : String(calculations.treeCount)],
          ] as const).map(([label, value]) => <div key={label} className="rounded-lg bg-[#eef5f1] px-3 py-2"><dt className="text-xs text-[#536c64]">{label}</dt><dd className="mt-1 text-lg font-semibold text-[#174b48]">{value}</dd></div>)}
        </dl>
        <p className="mt-3 text-sm text-[#536c64]">Yeni bina · {section.totalFloors} kat · {section.totalUnits} bağımsız bölüm · {areaText(section.totalArea)}</p>
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {([['Arsa Sahibi', calculations.owner], ['Müteahhit Payı', calculations.contractor]] as const).map(([label, share]) => <div key={label} className="rounded-lg border border-[#dfe9e4] p-3">
            <dt className="text-sm font-semibold">{label}</dt><dd className="mt-1 text-sm text-[#536c64]">{share.count} adet · {areaText(share.area)} · {share.percent === null ? '—' : `%${sqm.format(share.percent)}`}</dd>
          </div>)}
        </dl>
        {calculations.footprint === null && calculations.netEmsal === null && calculations.regimeArea === null && <p className="mt-2 text-sm text-[#536c64]">Otomatik kat alanları için Proje Yönetimi’nde arsa alanı ve TAKS veya KAKS girin. Kat alanlarını paftadan elle de girebilirsiniz.</p>}
      </div>

      <SectionSheet project={project} design={design} section={section} report={report} sloped={scenario.slope} onUnit={busy ? undefined : (unit, floor) => setEditing({ unit, floor })} onFloor={busy ? undefined : floor => setEditing({ floor })} />

      <div className="space-y-3 rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">Mevzuat ve Risk Analizi</h2>
        {categories.map(category => <section key={category}>
          <h3 className="text-sm font-semibold text-[#174b48]">{category}</h3>
          <ul className="mt-2 space-y-2">
            {legalNotes.filter(note => note.category === category).map(note => <li key={note.id} className={`rounded-lg p-3 text-sm ${note.severity === 'critical' ? 'border border-red-200 bg-red-50 text-red-900' : note.severity === 'warning' ? 'bg-amber-50 text-amber-950' : 'bg-[#f3f7f5] text-[#38584e]'}`}>
              {note.message} {note.source && <a href={note.source} target="_blank" rel="noreferrer" className="whitespace-nowrap underline">Kaynak</a>}
            </li>)}
          </ul>
        </section>)}
      </div>

      <SectionSheet project={project} design={design} section={section} report={report} sloped={scenario.slope} includeNotes={includeNotes} print />
    </section>

    {editing && <SectionEditor editing={editing} override={editing.unit ? design.units[editing.unit.id] : undefined} floorOverride={design.floorAreas[editing.floor.id]} serviceTitle={design.serviceTitle} floorSelected={design.contractorFloors.includes(editing.floor.id)} residenceLockReason={residenceLock.reason} onClose={() => setEditing(null)} onApply={applyEdit} />}
  </div>;
}
