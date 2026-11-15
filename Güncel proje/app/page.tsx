'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useProjects } from '@/components/project-context';
import { numberFields, projectFields, projectName, type Field, type Project } from '@/lib/projects';
import { MeasureModal } from '@/components/measure-modal';
import { buildMeasure, type Measure } from '@/lib/metraj';
import { BuildingCards } from '@/components/building-cards';
import { emptyBuilding, distributionError, MAX_BUILDINGS, type Building } from '@/lib/buildings';

const tabs = ['Dosya Yönetimi', 'Maliyet Hesabı', 'Kâr/Zarar', 'Teklif Çıktısı'];
const fields: { key: Field; label: string; type?: string; hint?: string; step?: string; options?: string[] }[] = [
  { key: 'semt', label: 'Semt', hint: 'Örn: Kadıköy' }, { key: 'ada', label: 'Ada' }, { key: 'parsel', label: 'Parsel' },
  { key: 'arsa_alani', label: 'Mevcut Arsa Alanı', type: 'number', hint: 'm²', step: 'any' },
  { key: 'taks', label: 'TAKS', type: 'number', hint: 'Örn: 0.30', step: '0.01' },
  { key: 'kaks', label: 'KAKS / Emsal', type: 'number', hint: 'Örn: 2.0', step: '0.01' },
  { key: 'bina_sayisi', label: 'Mevcut Bina Sayısı', type: 'number', hint: 'Adet', step: '1' },
  { key: 'insaat_alani', label: 'Mevcut Toplam İnşaat Alanı', type: 'number', hint: 'm² - Yıkım hesabı için', step: 'any' },
  { key: 'imar_tipi', label: 'İmar Tipi', options: ['Konut', 'Ticaret', 'Karma'] },
  { key: 'riskli_yapi', label: '6306 Riskli Yapı / Harç Muafiyeti', options: ['Evet', 'Hayır'] },
];
const blank = () => Object.fromEntries(projectFields.map(key => [key, ''])) as Record<Field, string>;

export default function Home() {
  const { projects, activeProject, selectProject, refresh, loading, error: loadError } = useProjects();
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState<number | null>(null);
  const [form, setForm] = useState(blank);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [modal, setModal] = useState(false);
  const [measureModal, setMeasureModal] = useState(false);
  const [measure, setMeasure] = useState<Measure | null>(null);
  const [measureConfirmed, setMeasureConfirmed] = useState(false);
  const measureSnapshot = useRef<{ value: Measure | null; confirmed: boolean }>({ value: null, confirmed: false });
  const [detailsReviewed, setDetailsReviewed] = useState(false);
  const buildingErrors = buildings.slice(0, Number(form.bina_sayisi) || 0).map(distributionError);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const inputClass = 'w-full rounded-lg border border-[#dbe5e2] bg-[#fbfcfc] px-3 py-3 text-sm outline-none focus:border-[#3d8173] focus:ring-2 focus:ring-[#dceee8]';

  function edit(project: Project) {
    let saved: Building[] = [];
    try { saved = project.binalar_detay ? JSON.parse(project.binalar_detay) : []; } catch { setError('Bina bilgileri okunamadı.'); return; }
    setEditing(project.id);
    setForm(Object.fromEntries(projectFields.map(key => [key, project[key] == null ? '' : String(project[key])])) as Record<Field, string>);
    const count = typeof project.bina_sayisi === 'number' ? Math.min(project.bina_sayisi, MAX_BUILDINGS) : 0;
    const restored = Array.from({ length: count }, (_, i) => saved[i] ? { ...emptyBuilding(), ...saved[i], normal_kat: saved[i].giriste_daire_yok === undefined && saved[i].normal_kat !== null ? Math.max(0, saved[i].normal_kat! - 1) : saved[i].normal_kat, giriste_daire_yok: saved[i].giriste_daire_yok ?? (saved[i].normal_kat === 0), kat_daireleri: saved[i].giriste_daire_yok === undefined && saved[i].normal_kat === 0 ? [null] : saved[i].kat_daireleri, bodrumda_daire_yok: saved[i].bodrumda_daire_yok ?? true, bodrum_daireleri: saved[i].bodrum_daireleri ?? Array(saved[i].bodrum_kat ?? 0).fill(null) } : emptyBuilding());
    if (!project.binalar_detay && count === 1) {
      restored[0] = { ...restored[0], daire_sayisi: typeof project.daire_sayisi === 'number' ? project.daire_sayisi : null, dukkan_sayisi: typeof project.dukkan_sayisi === 'number' ? project.dukkan_sayisi : null };
    }
    setBuildings(restored); setDetailsReviewed(Boolean(project.binalar_detay));
    try { setMeasure(project.daire_metraj_detaylari ? JSON.parse(project.daire_metraj_detaylari) : null); setMeasureConfirmed(Boolean(project.daire_metraj_detaylari)); } catch { setError('Metraj bilgileri okunamadı.'); return; }
    setError(''); setMessage('');
    document.getElementById('project-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function newProject() { setEditing(null); setForm(blank()); setBuildings([]); setMeasure(null); setMeasureConfirmed(false); setMeasureModal(false); setDetailsReviewed(false); setModal(false); setError(''); setMessage(''); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const count = form.bina_sayisi === '' ? 0 : Number(form.bina_sayisi);
    if (!Number.isInteger(count) || count < 0 || count > MAX_BUILDINGS) { setError('Bina sayısı 0 ile 100 arasında bir tam sayı olmalıdır.'); return; }
    const removed = buildings.slice(count);
    if (removed.some(b => b.ad || b.daire_sayisi !== null || b.dukkan_sayisi !== null || b.bodrum_kat !== null || b.normal_kat !== null) && !window.confirm('Bina sayısı azaltıldı. Gizlenen binaların bilgileri kaydedildiğinde silinecek. Devam edilsin mi?')) return;
    if (measure && !measureConfirmed) { setError('Bina veya inşaat alanı değişti. Metrajı tekrar kontrol edip kaydedin.'); return; }
    setBusy(true); setError(''); setMessage('');
    const body: Record<string, unknown> = Object.fromEntries(projectFields.map(key => [key, form[key].trim() === '' ? null : (numberFields as readonly string[]).includes(key) ? Number(form[key]) : form[key]]));
    const activeBuildings = buildings.slice(0, count);
    body.daire_metraj_detaylari = measureConfirmed ? measure : null;
    body.binalar_detay = activeBuildings.map(b => { const total = (b.normal_kat ?? 0) + (b.giriste_daire_yok ? 0 : 1) + (b.bodrumda_daire_yok ? 0 : (b.bodrum_kat ?? 0)); return b.esit_dagilim && total && b.daire_sayisi !== null && b.daire_sayisi % total === 0 ? { ...b, kat_daireleri: Array.from({length: (b.normal_kat ?? 0) + 1}, (_, i) => i === 0 && b.giriste_daire_yok ? null : b.daire_sayisi! / total), bodrum_daireleri: b.bodrumda_daire_yok ? b.bodrum_daireleri : Array(b.bodrum_kat ?? 0).fill(b.daire_sayisi / total) } : b; });
    for (const key of ['daire_sayisi', 'dukkan_sayisi'] as const) {
      if (activeBuildings.length && activeBuildings.every(b => b[key] !== null)) body[key] = activeBuildings.reduce((sum, b) => sum + (b[key] ?? 0), 0);
      else if (activeBuildings.some(b => b[key] !== null)) body[key] = null;
    }
    try {
      const response = await fetch(editing === null ? '/api/projects' : `/api/projects/${editing}`, { method: editing === null ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Proje kaydedilemedi.');
      newProject();
      try { await refresh(); setMessage('Proje kaydedildi.'); }
      catch { setError('Proje kaydedildi ancak liste yenilenemedi. Sayfayı yenileyin.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Proje kaydedilemedi.'); }
    finally { setBusy(false); }
  }
  function openMeasure() {
    try {
      const active = buildings.slice(0, Number(form.bina_sayisi));
      const area = Number(form.insaat_alani);
      if (!Number.isFinite(area) || area <= 0) throw new Error('İnşaat alanı sıfırdan büyük olmalıdır.');
      const next = buildMeasure(active, area, measure);
      if (measure) {
        const shape = (m: Measure) => m.binalar.map(b => b.katlar.map(f => [f.id, f.daireler.length]));
        if (JSON.stringify(shape(measure)) !== JSON.stringify(shape(next)) && !window.confirm('Bina veya kat düzeni değişti. Kaldırılan dairelere ait metraj bilgileri silinecek. Devam edilsin mi?')) return;
      }
      measureSnapshot.current = { value: measure, confirmed: measureConfirmed };
      setMeasure(next); setMeasureConfirmed(false); setMeasureModal(true); setError('');
    } catch (e) { setError(e instanceof Error ? e.message : 'Metraj açılamadı.'); }
  }
  async function remove(project: Project) {
    if (busy || !window.confirm(`“${projectName(project)}” kalıcı olarak silinsin mi? Bu işlem geri alınamaz.`)) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Proje silinemedi.'); }
      if (activeProject?.id === project.id) selectProject(null);
      if (editing === project.id) newProject();
      try { await refresh(); setMessage('Proje silindi.'); }
      catch { setError('Proje silindi ancak liste yenilenemedi. Sayfayı yenileyin.'); }
    } catch (err) { setError(err instanceof Error ? err.message : 'Proje silinemedi.'); }
    finally { setBusy(false); }
  }

  return <main className="min-h-screen bg-[#f6f8f8] text-[#142e32]">
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={event => { if (event.target === event.currentTarget) setModal(false); }}><div role="dialog" aria-modal="true" aria-labelledby="buildings-title" onKeyDown={event => { if (event.key === 'Escape') setModal(false); }} className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"><div className="flex justify-between gap-4"><h2 id="buildings-title" className="text-xl font-semibold">Bina detayları</h2><button type="button" onClick={() => setModal(false)} aria-label="Kapat" className="text-xl">✕</button></div><BuildingCards buildings={buildings.slice(0, Math.min(MAX_BUILDINGS, Math.max(0, Number(form.bina_sayisi) || 0)))} onChange={(index, value) => { setDetailsReviewed(false); setMeasureConfirmed(false); setBuildings(previous => previous.map((building, i) => i === index ? value : building)); }} />{buildingErrors.some(Boolean) && <p role="alert" className="mt-4 text-sm text-red-700">Bina bilgilerini ve daire dağılımını tamamlayın.</p>}<button type="button" disabled={buildingErrors.some(Boolean)} onClick={() => { setDetailsReviewed(true); setModal(false); }} className="mt-6 rounded-lg bg-[#174b48] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Kaydet</button></div></div>}
    {measureModal && measure && <MeasureModal buildings={buildings.slice(0, Number(form.bina_sayisi))} area={Number(form.insaat_alani)} value={measure} onChange={setMeasure} onClose={() => { setMeasure(measureSnapshot.current.value); setMeasureConfirmed(measureSnapshot.current.confirmed); setMeasureModal(false); }} onSave={value => { setMeasure(value); setMeasureConfirmed(true); setMeasureModal(false); }} />}
    <header className="border-b border-[#dfe8e6] bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5 lg:px-10"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#174b48] text-lg font-bold text-white">K</div><div><div className="font-bold tracking-tight">KENTSEL</div><div className="text-xs text-[#718482]">Fizibilite çalışma alanı</div></div></div><div className="w-full sm:w-72"><label htmlFor="active-project" className="mb-1 block text-xs font-semibold text-[#637d75]">Aktif Proje</label><select id="active-project" value={activeProject?.id ?? ''} onChange={event => selectProject(event.target.value ? Number(event.target.value) : null)} disabled={loading} className={inputClass}><option value="">Proje seçin</option>{projects.map(project => <option key={project.id} value={project.id}>{projectName(project)}</option>)}</select></div></div></header>
    <div className="mx-auto max-w-7xl px-6 lg:px-10"><nav aria-label="Ana menü" className="flex gap-8 overflow-x-auto border-b border-[#dfe8e6]">{tabs.map((name, i) => <button key={name} onClick={() => setTab(i)} aria-current={tab === i ? 'page' : undefined} className={`whitespace-nowrap border-b-2 py-5 text-sm font-medium ${tab === i ? 'border-[#1b6258] text-[#1b6258]' : 'border-transparent text-[#788987] hover:text-[#174b48]'}`}>{name}</button>)}</nav>
      <section className="py-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c908c]">Proje yönetimi / {tabs[tab]}</p><h1 className="mt-4 text-3xl font-semibold tracking-tight">{tabs[tab]}</h1><p className="mt-3 text-sm text-[#70817e]">{tab === 0 ? 'Proje bilgilerinizi oluşturun ve yönetin.' : activeProject ? `Aktif proje: ${projectName(activeProject)}` : 'Devam etmek için üst menüden bir proje seçin.'}</p>
      {tab === 0 ? <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div id="project-form" className="rounded-2xl border border-[#e2eae8] bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#739088]">Proje kimliği</p><h2 className="mt-2 text-xl font-semibold">{editing === null ? 'Yeni proje' : 'Projeyi düzenle'}</h2><p className="mt-2 text-sm text-[#788986]">Alanları istediğiniz zaman tamamlayabilirsiniz.</p></div>{editing !== null && <button type="button" onClick={newProject} disabled={busy} className="text-sm font-medium text-[#216a5e]">Yeni proje</button>}</div>
          <form onSubmit={save} className="mt-6"><div className="grid gap-4 sm:grid-cols-2">{fields.map(field => <div key={field.key} className={field.key === 'riskli_yapi' ? 'sm:col-span-2' : ''}><label htmlFor={field.key} className="mb-2 block text-sm font-medium">{field.label}</label>{field.options ? <select id={field.key} value={form[field.key]} onChange={event => setForm({ ...form, [field.key]: event.target.value })} className={inputClass}><option value="">Seçiniz</option>{field.options.map(option => <option key={option}>{option}</option>)}</select> : <input id={field.key} type={field.type || 'text'} min={field.type === 'number' ? 0 : undefined} max={field.key === 'bina_sayisi' ? MAX_BUILDINGS : undefined} step={field.step} maxLength={field.type === 'number' ? undefined : 100} value={form[field.key]} onChange={event => { const value = event.target.value; setForm({ ...form, [field.key]: value }); if (field.key === 'insaat_alani' || field.key === 'bina_sayisi') setMeasureConfirmed(false); if (field.key === 'bina_sayisi') { setDetailsReviewed(false); const n = Number(value); if (Number.isInteger(n) && n > 0 && n <= MAX_BUILDINGS) setBuildings(previous => Array.from({ length: Math.max(previous.length, n) }, (_, i) => previous[i] ?? emptyBuilding())); } }} className={inputClass} />}{field.hint && <span className="mt-1 block text-xs text-[#81928d]">{field.hint}</span>}{field.key === 'bina_sayisi' && Number(form.bina_sayisi) > 0 && <div className="mt-2"><button type="button" onClick={() => setModal(true)} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${detailsReviewed ? 'border-[#b9d4ca] text-[#216a5e]' : 'border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-200'}`}>Binaları Düzenle</button>{!detailsReviewed && <p className="mt-1 text-xs text-amber-700">Detayları girmeden kaydetmeyin.</p>}</div>}{field.key === 'insaat_alani' && detailsReviewed && Number(form.insaat_alani) > 0 && <button type="button" onClick={openMeasure} className="mt-2 rounded-lg border border-[#80b3a3] px-4 py-3 text-sm font-semibold text-[#216a5e]">Daire m² Düzenle</button>}</div>)}</div><button disabled={busy || loading} className="mt-6 w-full rounded-lg bg-[#174b48] px-4 py-3 text-sm font-semibold text-white hover:bg-[#22645b] disabled:opacity-60">{busy ? 'İşleniyor…' : 'Kaydet'}</button></form>
        </div>
        <div className="rounded-2xl border border-[#e2eae8] bg-white p-6 shadow-sm"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#739088]">Çalışma alanı</p><h2 className="mt-2 text-xl font-semibold">Projeler</h2><p className="mt-2 text-sm text-[#788986]">Semt ve ada sırasına göre listelenir.</p></div><span className="rounded-full bg-[#edf4f1] px-3 py-1 text-xs font-semibold text-[#4c786b]">{projects.length} proje</span></div>
          {(error || loadError) && <p role="alert" className="mt-5 text-sm text-red-700">{error || loadError}</p>}{message && <p role="status" className="mt-5 text-sm text-[#236b53]">{message}</p>}
          {loading ? <p className="py-12 text-center text-sm text-[#788986]">Projeler yükleniyor…</p> : projects.length === 0 ? <p className="mt-6 rounded-xl border border-dashed border-[#dbe6e2] p-10 text-center text-sm text-[#788986]">Henüz proje yok.</p> : <div className="mt-6 grid gap-3 sm:grid-cols-2">{projects.map(project => <article key={project.id} className="rounded-xl border border-[#e2eae8] bg-[#fbfcfc] p-5"><div className="flex justify-between gap-2"><span className="text-xl text-[#4b8171]">▤</span>{activeProject?.id === project.id && <span className="text-xs font-semibold text-[#367a65]">Aktif</span>}</div><h3 className="mt-4 break-words font-semibold">{projectName(project)}</h3><div className="mt-5 flex gap-5"><button disabled={busy} onClick={() => edit(project)} aria-label={`${projectName(project)} düzenle`} className="text-sm font-semibold text-[#216a5e] disabled:opacity-50">Düzenle</button><button disabled={busy} onClick={() => remove(project)} aria-label={`${projectName(project)} sil`} className="text-sm font-semibold text-[#a44747] disabled:opacity-50">Sil</button></div></article>)}</div>}
        </div></div> : <div className="mt-10 rounded-2xl border border-[#e2eae8] bg-white p-10 text-sm text-[#788986]">Bu bölümün işlevleri ilgili aşamada eklenecek.</div>}</section></div>
  </main>;
}
