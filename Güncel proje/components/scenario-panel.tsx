'use client';
import { useState } from 'react';
import { useProjects } from '@/components/project-context';
import type { Project } from '@/lib/projects';
import { emptyScenario, simulate, validateScenario, type Scenario } from '@/lib/scenario';

const format = (n: number | null) => n !== null && Number.isFinite(n) ? `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 }).format(n)} m²` : 'Bilgi eksik';
export function ScenarioPanel({ project }: { project: Project }) {
  const { refresh } = useProjects();
  const [scenario, setScenario] = useState<Scenario>(() => { try { return project.architectural_scenarios ? validateScenario(JSON.parse(project.architectural_scenarios)) : emptyScenario(); } catch { return emptyScenario(); } });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const stats = simulate(project, scenario);
  const update = (patch: Partial<Scenario>) => { setScenario(current => ({ ...current, ...patch })); setMessage(''); setError(''); };
  async function save() {
    if (busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      const result = await fetch(`/api/projects/${project.id}/scenario`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(scenario) });
      const body = await result.json();
      if (!result.ok) throw new Error(body.error || 'Senaryo kaydedilemedi.');
      try { await refresh(); setMessage('Senaryo kaydedildi.'); }
      catch { setError('Senaryo kaydedildi, ancak proje listesi yenilenemedi.'); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Senaryo kaydedilemedi.'); }
    finally { setBusy(false); }
  }
  const control = (checked: boolean, action: (value: boolean) => void, title: string, description?: string) => <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e1ebe7] p-4"><input type="checkbox" checked={checked} onChange={e => action(e.target.checked)} className="mt-1 h-4 w-4 accent-[#216a5e]" /><span><strong className="block text-sm">{title}</strong>{description && <span className="mt-1 block text-sm leading-5 text-[#788986]">{description}</span>}</span></label>;
  const alertClass = 'rounded-xl border p-4 text-sm leading-6';
  return <div className="mt-8 grid items-start gap-6 lg:grid-cols-2">
    <section className="space-y-4 rounded-2xl border border-[#e2eae8] bg-white p-6 shadow-sm"><div><p className="text-xs font-semibold uppercase tracking-wider text-[#739088]">Senaryo girdileri</p><h2 className="mt-2 text-xl font-semibold">Varsayımları belirleyin</h2><p className="mt-2 text-sm text-[#788986]">Tüm seçimler isteğe bağlıdır.</p></div>
      {control(scenario.bonus, value => update({ bonus: value }), '%30 emsal harici varsayımı', 'Simülasyonda emsal alanına %30 ekle.')}
      {control(scenario.slope, value => update({ slope: value }), 'Kot farkı (eğim)', 'Arsada kot farkı var mı?')}
      {scenario.slope && <label className="block text-sm font-medium">Kaç kat açığa çıkıyor?<input type="number" min="0" max="100" step="1" value={scenario.exposedFloors ?? ''} onChange={e => update({ exposedFloors: e.target.value === '' ? null : Number(e.target.value) })} className="mt-2 block w-full rounded-lg border border-[#dbe5e2] px-3 py-3" /></label>}
      {control(scenario.projection, value => update({ projection: value }), 'Çıkma durumu', 'Üst katlarda çıkma yapılacak mı?')}
      {scenario.projection && <label className="block text-sm font-medium">Çıkma türü<select value={scenario.projectionType} onChange={e => update({ projectionType: e.target.value as Scenario['projectionType'] })} className="mt-2 block w-full rounded-lg border border-[#dbe5e2] px-3 py-3"><option value="">Seçiniz</option><option value="open">Açık Çıkma (Balkon)</option><option value="closed">Kapalı Çıkma (Odaya Dahil)</option></select></label>}
      <fieldset className="space-y-3"><legend className="mb-2 text-sm font-semibold">Fiziki kısıtlar</legend>{control(scenario.narrow, value => update({ narrow: value }), 'Dar Arsa / Çekme Mesafesi Kısıtı')}{control(scenario.heightLimit, value => update({ heightLimit: value }), 'YENÇOK (Maksimum Yükseklik / Kat) Sınırı')}</fieldset>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{message && <p role="status" className="text-sm text-[#236b53]">{message}</p>}
      <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-[#174b48] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{busy ? 'Kaydediliyor…' : 'Senaryoyu Kaydet'}</button>
    </section>
    <section className="rounded-2xl border border-[#e2eae8] bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-[#739088]">Canlı simülasyon</p><h2 className="mt-2 text-xl font-semibold">Alanlar ve uyarılar</h2><p className="mt-2 text-sm leading-6 text-[#788986]">Kayıtlı mevcut yapı verileri ve seçilen varsayımlar kullanılır.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">{[
        ['Arsa alanı', format(typeof project.arsa_alani === 'number' ? project.arsa_alani : null)],
        ['TAKS / KAKS', `${project.taks ?? '—'} / ${project.kaks ?? '—'}`],
        ['Toplam daire / bağımsız bölüm', `${project.daire_sayisi ?? '—'} / ${stats.units ?? '—'}`],
        ['En yüksek mevcut bina katı', stats.floors === null ? 'Bilgi eksik' : String(stats.floors)],
        ['Mevcut toplam inşaat alanı', format(typeof project.insaat_alani === 'number' ? project.insaat_alani : null)],
        ['Teorik emsal alanı (Arsa × KAKS)', format(stats.kaksArea)],
        ['Varsayımsal brüt alan', format(stats.gross)],
        ['Kot farkı alan varsayımı', stats.slopeArea === null ? '—' : format(stats.slopeArea)],
      ].map(([label, value]) => <div key={label} className="rounded-xl bg-[#f3f8f5] p-4"><p className="text-xs leading-5 text-[#70877f]">{label}</p><p className="mt-2 text-lg font-semibold text-[#205b50]">{value}</p></div>)}</div>
      <p className="mt-4 text-xs leading-5 text-[#788986]">KAKS alanı otomatik olarak satılabilir net alan değildir. %30 ve kot farkı sonuçları varsayımdır; emsal harici kullanım, açıkta kalan katlar ve çıkmalar için plan, ruhsat ve mevzuat koşulları ayrıca değerlendirilmelidir. Kot alanı diğer toplamın üzerine otomatik eklenmez.</p>
      <h3 className="mt-7 text-lg font-semibold">Mevzuat ve Risk Analizi</h3><div className="mt-4 space-y-3">
        {scenario.narrow && scenario.heightLimit ? <p className={`${alertClass} border-red-200 bg-red-50 text-red-800`}>⚠️ KRİTİK UYARI: Hem dar arsa hem yükseklik sınırınız var. İmar hakkınızın tamamını kullanamama (kayıp emsal) riski değerlendirilmelidir.</p> : scenario.narrow ? <p className={`${alertClass} border-amber-200 bg-amber-50 text-amber-900`}>Bilgi: Taban oturumunuz daralabilir; emsali doldurmak için kat sayısını artırmanız gerekebilir.</p> : scenario.heightLimit ? <p className={`${alertClass} border-amber-200 bg-amber-50 text-amber-900`}>Bilgi: Kat sınırınız olabilir; emsali doldurmak için taban oturumu ve TAKS birlikte incelenmelidir.</p> : null}
        {stats.shelter && <p className={`${alertClass} border-amber-200 bg-amber-50 text-amber-900`}>⚠️ Sığınak gerekliliğini kontrol edin. Yapı türü, bağımsız bölüm niteliği ve emsale esas alan sonucu değiştirir; mevcut toplam inşaat alanı emsale esas alanla aynı olmayabilir.</p>}
        {stats.elevator && <p className={`${alertClass} border-amber-200 bg-amber-50 text-amber-900`}>⚠️ Asansör gerekliliğini ve kat hesabını kontrol edin; bodrum kullanımı ve yürürlükteki hükümler önemlidir.</p>}
        {stats.highRise && <p className={`${alertClass} border-amber-200 bg-amber-50 text-amber-900`}>⚠️ Asansör sayısı ve yangın kaçış koşullarını kontrol edin; bina yüksekliği, kullanım türü ve bağımsız bölümler sonucu etkiler.</p>}
        {stats.caretaker && <p className={`${alertClass} border-amber-200 bg-amber-50 text-amber-900`}>⚠️ Kapıcı dairesi gerekliliğini konut sayısı ve ilgili plan hükümleriyle kontrol edin.</p>}
        {(stats.units === null || stats.floors === null || project.insaat_alani === null) && <p className={`${alertClass} border-[#e1ebe7] bg-[#f7faf8] text-[#647d74]`}>Bazı yapı bilgileri eksik; tüm eşik kontrolleri yapılamadı.</p>}
        <p className="text-xs leading-5 text-[#788986]">Bu uyarılar ön taramadır; mevcut binanın verileri yeni proje koşullarını doğrulamaz. Projeye uygulanacak güncel hükümleri ve belediye plan notlarını yetkili uzmanla kontrol edin.</p>
      </div>
    </section>
  </div>;
}
