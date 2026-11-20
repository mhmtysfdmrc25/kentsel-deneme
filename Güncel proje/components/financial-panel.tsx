'use client';

import { useMemo, useRef, useState, type FormEvent } from 'react';
import { FormattedNumberInput } from '@/components/formatted-number-input';
import { useProjects } from '@/components/project-context';
import { savedQuickAid } from '@/lib/costs';
import {
  calculateFinancial, financialInventory, MAX_FINANCIAL_VALUE, readFinancialScenario, type FinancialScenario,
} from '@/lib/financial';
import { formatNumber } from '@/lib/number-format';
import type { Project } from '@/lib/projects';

const card = 'min-w-0 rounded-2xl border border-[#dfe9e4] bg-white p-5 shadow-sm';
const buttonClass = 'rounded-lg bg-[#174b48] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#216a5e] disabled:cursor-default disabled:opacity-50';
const moneyFormat = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (value: number | null) => value === null ? '—' : `${moneyFormat.format(value)} TL`;
const area = (value: number | null) => value === null ? '—' : `${formatNumber(value)} m²`;
const percent = (value: number | null) => value === null ? '—' : `%${formatNumber(value)}`;
type Result = ReturnType<typeof calculateFinancial>;
type NumberField = Exclude<keyof FinancialScenario, 'useAveragePrices' | 'unitPrices'>;
const unitTypes = { apartment: 'Daire', duplex: 'Dubleks', shop: 'Dükkan', storage: 'Depo', parking: 'Otopark' } as const;
const expenseColors: Record<string, string> = {
  construction: 'bg-[#446278]', 'saved-aid': 'bg-[#84754d]', rent: 'bg-[#84754d]',
  moving: 'bg-[#a87954]', marketing: 'bg-[#4b8079]', finance: 'bg-[#86739f]', risk: 'bg-[#a05a62]',
};

function FinancialPrint({ project, result }: { project: Project; result: Result }) {
  return <div className="financial-print-layout" aria-hidden="true">
    <article className="financial-report-page">
      <header>
        <h2>Yönetici Özeti</h2>
        <p>{[project.semt, project.mahalle].filter(Boolean).join(' / ')}</p>
        <p>Ada {project.ada ?? '—'} · Parsel {project.parsel ?? '—'}</p>
      </header>
      <dl className="financial-report-metrics">
        <div><dt>Toplam gelir</dt><dd>{money(result.revenue)}</dd></div>
        <div><dt>Toplam gider</dt><dd>{money(result.totalCost)}</dd></div>
        <div><dt>Net kâr / zarar</dt><dd>{money(result.profit)}</dd></div>
        <div><dt>Kâr marjı</dt><dd>{percent(result.margin)}</dd></div>
        <div><dt>Yatırımın geri dönüşü (ROI)</dt><dd>{percent(result.roi)}</dd></div>
      </dl>
      <table>
        <caption>Gider kırılımı</caption>
        <thead><tr><th scope="col">Gider kalemi</th><th scope="col">Tutar</th></tr></thead>
        <tbody>{result.expenseLines.map(expense => <tr key={expense.id}><th scope="row">{expense.label}</th><td>{money(expense.amount)}</td></tr>)}</tbody>
        <tfoot><tr><th scope="row">Toplam gider</th><td>{money(result.totalCost)}</td></tr></tfoot>
      </table>
      <footer>Asdem Yapı - Finansal Ön Fizibilite Raporu</footer>
    </article>
  </div>;
}

function ProfitBar({ result }: { result: Result }) {
  if (result.revenue === null || result.totalCost === null) return null;
  const scale = Math.max(result.revenue, result.totalCost);
  if (scale <= 0) return null;
  const coveredCost = Math.min(result.revenue, result.totalCost) / scale * 100;
  const profit = Math.max(0, result.revenue - result.totalCost) / scale * 100;
  const shortfall = Math.max(0, result.totalCost - result.revenue) / scale * 100;
  return <div className="mt-5">
    <div className="flex h-3 overflow-hidden rounded-full bg-[#eef3f2]" aria-hidden="true">
      <span style={{ width: `${coveredCost}%` }} className="bg-[#73848e]" />
      <span style={{ width: `${profit}%` }} className="bg-[#278268]" />
      <span style={{ width: `${shortfall}%` }} className="bg-[#c74e5a]" />
    </div>
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#536c64]">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#73848e]" />{shortfall > 0 ? 'Gelirle karşılanan gider' : 'Gider'}</span>
      {profit > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#278268]" />Kâr</span>}
      {shortfall > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#c74e5a]" />Gider açığı</span>}
    </div>
  </div>;
}

export function FinancialPanel({ project }: { project: Project }) {
  const { activeCostTotal, activeArchitectureDraft, activeFinancialDraft, setFinancialDraft, refresh } = useProjects();
  const [initial] = useState(() => readFinancialScenario(project.financial_scenarios));
  const draft = activeFinancialDraft ?? initial;
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ error: boolean; text: string } | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const inventory = useMemo(() => financialInventory(project, activeArchitectureDraft), [project, activeArchitectureDraft]);
  const includedAid = savedQuickAid(project, activeCostTotal);
  const result = calculateFinancial(draft, inventory, activeCostTotal, includedAid);
  const { sales, expenseLines, revenue, totalCost, profit } = result;
  const hasUnits = sales.length > 0;

  function update(patch: Partial<FinancialScenario>) {
    setFinancialDraft(project.id, { ...draft, ...patch });
    setFeedback(null);
  }

  function field(key: NumberField, label: string, unit: string, options?: { integer?: boolean; hint?: string }) {
    return <FormattedNumberInput
      label={label} unit={unit} value={draft[key]} max={unit === '%' ? 100 : MAX_FINANCIAL_VALUE}
      onChange={value => update({ [key]: value })} {...options}
    />;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/financial`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Finansal senaryo kaydedilemedi.');
      }
      try { await refresh(); setFeedback({ error: false, text: 'Finansal senaryo kaydedildi.' }); }
      catch { setFeedback({ error: false, text: 'Finansal senaryo kaydedildi. Proje listesi yenilenemedi.' }); }
    } catch (error) {
      setFeedback({ error: true, text: error instanceof Error ? error.message : 'Finansal senaryo kaydedilemedi.' });
    } finally { setBusy(false); }
  }

  return <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
    <form ref={form} onSubmit={save} className={`${card} space-y-5`} aria-labelledby="financial-inputs">
      <h2 id="financial-inputs" className="text-xl font-semibold tracking-tight">Ticari ve Kentsel Dönüşüm Parametreleri</h2>
      <fieldset disabled={busy} className="space-y-4">
        <legend className="mb-3 text-sm font-bold text-[#174b48]">Satış Senaryoları</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {field('residentialRate', 'Konut (Daire) Ortalama Satış m² Fiyatı', 'TL/m²')}
          {field('commercialRate', 'Ticari (Dükkan) Ortalama Satış m² Fiyatı', 'TL/m²')}
        </div>
        <p className="text-xs text-[#536c64]">Ortalama satış fiyatı brüt m² üzerinden uygulanır.</p>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={draft.useAveragePrices} onChange={event => update({ useAveragePrices: event.target.checked })} className="h-4 w-4 accent-[#216a5e]" />
          Ortalama fiyat kullan
        </label>
        {hasUnits && <details open={!draft.useAveragePrices || undefined} className="overflow-hidden rounded-xl border border-[#dfe9e4]">
          <summary className="cursor-pointer bg-[#f6f9f7] px-3 py-2.5 text-sm font-semibold text-[#174b48]">Müteahhit payı · {sales.length} bağımsız bölüm</summary>
          <div className="max-h-80 divide-y divide-[#e1eae6] overflow-auto">
            {sales.map(unit => {
              const column = Number(unit.id.split(':')[1]) + 1;
              const position = `${unit.floor} · ${column}. sütun`;
              return <div key={unit.id} data-financial-unit={unit.id} className="space-y-2 px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                  <p className="text-sm font-medium">{unit.title} <span className="text-xs text-[#536c64]">· {unitTypes[unit.type]} · {position}</span></p>
                  <span className="text-sm font-semibold tabular-nums">{money(unit.sale)}</span>
                </div>
                <p className="text-xs text-[#536c64]">Brüt {area(unit.gross)} · Net {area(unit.net)}</p>
                {!draft.useAveragePrices && <FormattedNumberInput
                  label={`${unit.title} · ${position} satış fiyatı`} unit="TL" max={MAX_FINANCIAL_VALUE}
                  value={draft.unitPrices[unit.id] ?? null} placeholder="Ortalama fiyat"
                  onChange={value => {
                    const unitPrices = { ...draft.unitPrices };
                    if (value === null) delete unitPrices[unit.id];
                    else unitPrices[unit.id] = value;
                    update({ unitPrices });
                  }}
                />}
              </div>;
            })}
          </div>
        </details>}
      </fieldset>

      <fieldset disabled={busy} className="space-y-3 border-t border-[#e2eae8] pt-4">
        <legend className="pr-2 text-sm font-bold text-[#174b48]">Kentsel Dönüşüm Giderleri</legend>
        <FormattedNumberInput label="Arsa Sahibi Daire Sayısı" unit="Adet" integer max={MAX_FINANCIAL_VALUE}
          value={result.ownerHomes} onChange={ownerHomes => update({ ownerHomes })}
          hint={`Mimari Simülatör’de arsa sahibine kalan ${formatNumber(inventory.ownerHomes)} daire. Otomatik adede dönmek için alanı temizleyin.`} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {field('monthlyRent', 'Aylık Kira Yardımı (Daire Başı)', 'TL')}
          {field('rentMonths', 'Kira Süresi (Ay)', 'Ay', { integer: true })}
        </div>
        {field('movingAid', 'Taşınma Yardımı (Daire Başı Tek Seferlik)', 'TL')}
        {includedAid !== null && includedAid > 0 && <p className="text-xs text-[#536c64]">
          Hızlı Fizibilite’de kayıtlı kira ve taşınma yardımı {money(includedAid)}. Bu alanda bir yardım senaryosu girildiğinde yeni tutar esas alınır.
        </p>}
        {project.cost_mode === 'detailed' && <p className="text-xs text-[#536c64]">Bu alana Detaylı Keşif kalemlerine dahil edilmemiş yardımları girin.</p>}
      </fieldset>

      <fieldset disabled={busy} className="space-y-3 border-t border-[#e2eae8] pt-4">
        <legend className="pr-2 text-sm font-bold text-[#174b48]">Finansman ve Pazarlama</legend>
        {field('marketingRate', 'Pazarlama ve Komisyon Gideri (%)', '%', { hint: 'Satış geliri üzerinden hesaplanır.' })}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {field('financeRate', 'Finansman (Kredi/Faiz) Gideri (%)', '%')}
          {field('riskRate', 'Beklenmeyen Giderler (Risk Payı) (%)', '%')}
        </div>
        <p className="text-xs text-[#536c64]">Finansman ve risk payı, inşaat ile kira ve taşınma yardımlarının toplamı üzerinden hesaplanır.</p>
      </fieldset>
      <button disabled={busy} type="submit" className={buttonClass}>{busy ? 'Kaydediliyor…' : 'Senaryoyu Kaydet'}</button>
      {feedback && <p role={feedback.error ? 'alert' : 'status'} className={`text-sm ${feedback.error ? 'text-red-700' : 'text-[#216a5e]'}`}>{feedback.text}</p>}
    </form>

    <section aria-labelledby="financial-dashboard" className="min-w-0 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 id="financial-dashboard" className="text-xl font-semibold tracking-tight">Canlı Finansal Pano ve Kârlılık Analizi</h2>
        <button type="button" onClick={() => { if (form.current?.reportValidity()) window.print(); }} disabled={profit === null} className={buttonClass}>Yönetici Özeti (PDF İndir)</button>
      </div>
      {!hasUnits && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Lütfen önce Mimari Simülatörden müteahhit payını belirleyin.</p>}
      {activeCostTotal === null && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Toplam gider için Maliyet Analizi’nde maliyeti kaydedin.</p>}
      {hasUnits && revenue === null && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Toplam gelir için satış fiyatlarını ve brüt alanı tamamlayın. Brüt alanı eksik bölüme doğrudan satış fiyatı da girebilirsin.</p>}
      {result.rentIncomplete && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Kira yardımı için aylık tutarı ve süreyi birlikte girin.</p>}
      <div className={card}>
        <h3 className="text-base font-semibold">Satılabilir Alan</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><dt className="text-xs text-[#536c64]">Toplam brüt</dt><dd className="mt-1 font-semibold tabular-nums" data-financial-gross>{area(result.grossArea)}</dd></div>
          <div><dt className="text-xs text-[#536c64]">Toplam net</dt><dd className="mt-1 font-semibold tabular-nums" data-financial-net>{area(result.netArea)}</dd></div>
          <div><dt className="text-xs text-[#536c64]">Konut brüt</dt><dd className="mt-1 font-semibold tabular-nums">{hasUnits ? area(result.residentialArea) : '—'}</dd></div>
          <div><dt className="text-xs text-[#536c64]">Ticari brüt</dt><dd className="mt-1 font-semibold tabular-nums">{hasUnits ? area(result.commercialArea) : '—'}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-[#536c64]">Müteahhit {formatNumber(sales.length)} bölüm · Arsa sahibi {formatNumber(inventory.ownerUnits)} bölüm</p>
        {hasUnits && result.netArea === null && <p className="mt-1 text-xs text-[#536c64]">Net toplam, tüm satılabilir bölümlerin net alanı Mimari Simülatör’de girildiğinde görünür.</p>}
      </div>
      <dl className="grid gap-3 sm:grid-cols-3" aria-live="polite">
        <div className="min-w-0 rounded-xl border border-[#c9e5d9] bg-[#e9f6ee] px-3 py-4"><dt className="text-xs font-bold uppercase text-[#246a52]">Toplam gelir</dt><dd data-financial-revenue className="mt-2 break-words text-xl font-semibold tabular-nums text-[#174c3c]">{money(revenue)}</dd></div>
        <div className="min-w-0 rounded-xl border border-[#edd8d9] bg-[#fbefef] px-3 py-4"><dt className="text-xs font-bold uppercase text-[#964049]">Toplam gider</dt><dd data-financial-cost className="mt-2 break-words text-xl font-semibold tabular-nums text-[#802b36]">{money(totalCost)}</dd></div>
        <div className={`min-w-0 rounded-xl border px-3 py-4 ${profit !== null && profit < 0 ? 'border-[#edd8d9] bg-[#fbefef] text-[#802b36]' : 'border-[#d5e5ed] bg-[#eaf3f8] text-[#215267]'}`}>
          <dt className="text-xs font-bold uppercase">Net kâr / zarar</dt><dd data-financial-profit className="mt-2 break-words text-xl font-semibold tabular-nums">{money(profit)}</dd>
        </div>
      </dl>

      <div className={card}>
        <h3 className="text-base font-semibold">Kârlılık Göstergeleri</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-[#536c64]">Kâr marjı</dt><dd className="mt-1 text-lg font-semibold tabular-nums" data-financial-margin>{percent(result.margin)}</dd></div>
          <div><dt className="text-xs text-[#536c64]">Yatırımın geri dönüşü (ROI)</dt><dd className="mt-1 text-lg font-semibold tabular-nums" data-financial-roi>{percent(result.roi)}</dd></div>
        </dl>
        <ProfitBar result={result} />
      </div>

      <div className={card}>
        <h3 className="text-base font-semibold">Gider Kırılımı</h3>
        <ul className="mt-4 space-y-3">
          {expenseLines.map(expense => {
            const share = expense.amount !== null && totalCost !== null && totalCost > 0 ? expense.amount / totalCost * 100 : null;
            return <li key={expense.id} data-financial-expense={expense.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
                <span>{expense.label}</span>
                <span className="font-medium tabular-nums">{money(expense.amount)}{share !== null && <span className="ml-2 text-xs text-[#536c64]">{percent(share)}</span>}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#edf2f1]" aria-hidden="true">
                <div style={{ width: `${share ?? 0}%` }} className={`h-full rounded-full ${expenseColors[expense.id]}`} />
              </div>
            </li>;
          })}
        </ul>
      </div>
      <FinancialPrint project={project} result={result} />
    </section>
  </div>;
}
