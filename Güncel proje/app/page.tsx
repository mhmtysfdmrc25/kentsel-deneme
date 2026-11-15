'use client';
import { useEffect, useState, type FormEvent } from 'react';

type Project = { id: number; semt: string; ada: string; parsel: string; created_at: string; updated_at: string };
const tabs = ['Dosya Yönetimi', 'Maliyet Hesabı', 'Kâr/Zarar', 'Teklif Çıktısı'];
const fields = [{ key: 'semt', label: 'Semt', placeholder: 'Örn. Kadıköy' }, { key: 'ada', label: 'Ada', placeholder: 'Örn. 1234' }, { key: 'parsel', label: 'Parsel', placeholder: 'Örn. 56' }] as const;

export default function Home() {
  const [active, setActive] = useState(0);
  const [form, setForm] = useState({ semt: '', ada: '', parsel: '' });
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch('/api/projects', { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error();
        setProjects(await response.json());
      } catch {
        if (!controller.signal.aborted) setError('Projeler yüklenemedi. Sayfayı yenileyerek tekrar deneyin.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (Object.values(form).some(value => !value.trim())) { setError('Lütfen tüm alanları doldurun.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Proje kaydedilemedi.');
      setProjects(previous => [result, ...previous]);
      setForm({ semt: '', ada: '', parsel: '' });
      setNotice('Proje başarıyla oluşturuldu.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Proje kaydedilemedi.'); }
    finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f6f8f8] text-[#142e32]">
    <header className="border-b border-[#dfe8e6] bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5 lg:px-10"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#174b48] text-lg font-bold text-white">K</div><div><div className="font-bold tracking-tight">KENTSEL</div><div className="text-xs text-[#718482]">Fizibilite çalışma alanı</div></div></div><span className="rounded-full border border-[#dbe8e3] bg-[#f3f8f5] px-3 py-1.5 text-xs font-medium text-[#3e6c5e]">● Yerel çalışma alanı</span></div></header>
    <div className="mx-auto max-w-7xl px-6 lg:px-10"><nav aria-label="Ana menü" className="flex gap-8 overflow-x-auto border-b border-[#dfe8e6]">{tabs.map((tab, i) => <button key={tab} onClick={() => setActive(i)} aria-current={active === i ? 'page' : undefined} className={`whitespace-nowrap border-b-2 py-5 text-sm font-medium transition ${active === i ? 'border-[#1b6258] text-[#1b6258]' : 'border-transparent text-[#788987] hover:text-[#174b48]'}`}>{tab}</button>)}</nav>
      <section className="py-10 md:py-12"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7c908c]">Proje yönetimi / {tabs[active]}</p><h1 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">{tabs[active]}</h1><p className="mt-3 text-sm leading-6 text-[#70817e]">{active === 0 ? 'Projelerinizi oluşturun ve tüm çalışmalarınıza tek yerden ulaşın.' : 'Bu bölümün işlevleri yol haritasındaki ilgili aşamada eklenecek.'}</p>
      {active === 0 ? <div className="mt-10 grid items-start gap-6 lg:grid-cols-[360px_1fr]">
        <div className="rounded-2xl border border-[#e2eae8] bg-white p-6 shadow-[0_12px_35px_rgba(20,46,50,0.04)]"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#739088]">Yeni çalışma</p><h2 className="mt-3 text-xl font-semibold">Proje oluştur</h2><p className="mt-2 text-sm leading-6 text-[#788986]">Başlamak için proje konumunu ve parsel bilgilerini girin.</p>
          <form onSubmit={createProject} className="mt-7 space-y-5">{fields.map(({key, label, placeholder}) => <div key={key}><label htmlFor={key} className="mb-2 block text-sm font-medium">{label}</label><input id={key} name={key} required maxLength={100} value={form[key]} onChange={event => setForm({ ...form, [key]: event.target.value })} placeholder={placeholder} className="w-full rounded-lg border border-[#dbe5e2] bg-[#fbfcfc] px-4 py-3 text-sm outline-none transition placeholder:text-[#a4b2af] focus:border-[#3d8173] focus:ring-2 focus:ring-[#dceee8]" /></div>)}
            <button disabled={saving || loading} type="submit" className="w-full rounded-lg bg-[#174b48] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#22645b] disabled:cursor-not-allowed disabled:opacity-60">{saving ? 'Kaydediliyor…' : 'Yeni Proje Oluştur'} <span aria-hidden="true" className="ml-2">→</span></button>
          </form>{error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{notice && <p role="status" className="mt-4 text-sm text-[#236b53]">{notice}</p>}</div>
        <div className="rounded-2xl border border-[#e2eae8] bg-white p-6 shadow-[0_12px_35px_rgba(20,46,50,0.04)] md:p-8"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#739088]">Çalışma alanı</p><h2 className="mt-3 text-xl font-semibold">Geçmiş projeler</h2><p className="mt-2 text-sm text-[#788986]">Kaydedilen projelerinize buradan ulaşabilirsiniz.</p></div><span className="rounded-full bg-[#edf4f1] px-3 py-1 text-xs font-semibold text-[#4c786b]">{projects.length} proje</span></div>
          {loading ? <p role="status" className="py-14 text-center text-sm text-[#788986]">Projeler yükleniyor…</p> : projects.length === 0 ? <div className="mt-7 rounded-xl border border-dashed border-[#dbe6e2] bg-[#fafcfb] px-5 py-14 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#eaf3ef] text-xl text-[#568879]">▤</div><p className="mt-4 font-medium">Henüz proje yok</p><p className="mt-2 text-sm text-[#879793]">İlk projenizi oluşturmak için formu doldurun.</p></div> : <div className="mt-7 grid gap-4 sm:grid-cols-2">{projects.map(project => <article key={project.id} className="flex flex-col rounded-xl border border-[#e2eae8] bg-[#fbfcfc] p-5"><div className="grid h-10 w-10 place-items-center rounded-lg bg-[#e8f2ee] text-lg text-[#4b8171]">▤</div><h3 className="mt-4 break-words font-semibold">{project.semt} <span className="font-normal text-[#68847c]">{project.ada}/{project.parsel}</span></h3><p className="mt-1 text-xs text-[#899a96]">Ada / Parsel</p><button onClick={() => console.log('Proje aç:', project)} className="mt-6 self-start text-sm font-semibold text-[#216a5e] hover:text-[#123e39]">Projeyi Aç <span aria-hidden="true">→</span></button></article>)}</div>}
        </div></div> : <div className="mt-10 rounded-2xl border border-[#e2eae8] bg-white p-10 text-sm text-[#788986]">Çalışma alanı hazırlanıyor.</div>}</section></div>
  </main>;
}
