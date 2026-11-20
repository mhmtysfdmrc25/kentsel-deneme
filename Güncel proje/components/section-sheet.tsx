'use client';

import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { flushSync } from 'react-dom';
import type { Project } from '@/lib/projects';
import { defaultHeading, type BuildingDesign, type Section, type SectionFloor, type SectionUnit } from '@/lib/simulator';
import type { RuleSettings, evaluateImarRules } from '@/lib/imarRules';

type SheetReport = {
  settings: RuleSettings;
  evaluation: ReturnType<typeof evaluateImarRules>;
  parameters: [string, string][];
};
type SheetProps = {
  project: Project;
  design: BuildingDesign;
  section: Section;
  onUnit?: (unit: SectionUnit, floor: SectionFloor) => void;
  onFloor?: (floor: SectionFloor) => void;
  print?: boolean;
  report?: SheetReport;
  includeNotes?: boolean;
  sloped?: boolean;
};

const width = 760;
const left = 155;
const buildingWidth = 592;
const headerHeight = 49;
const rowHeight = 53;
const roofHeights = { pitched: 48, mansard: 86, terrace: 38 };
const isolationHeight = 24;
const squareMetres = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const area = (value: number | null) => value === null ? '—' : `${squareMetres.format(value)} m²`;

function shortened(value: string, limit: number) {
  const characters = Array.from(value);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : value;
}

function fit(value: string, available: number, characterWidth: number) {
  return value.length * characterWidth > available ? { textLength: available, lengthAdjust: 'spacingAndGlyphs' as const } : {};
}

function Drawing({ design, section, onUnit, onFloor, settings, sloped, excess }: {
  design: BuildingDesign;
  section: Section;
  onUnit?: SheetProps['onUnit'];
  onFloor?: SheetProps['onFloor'];
  settings?: RuleSettings;
  sloped?: boolean;
  excess?: boolean;
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const hatch = `kesit-tarama-${id}`;
  const dots = `kesit-yalitim-${id}`;
  const hasIsolation = Boolean(settings?.isolation && design.ground && design.basementFloors);
  const commercialGround = settings?.use === 'ground-commercial' || settings?.use === 'mixed' || settings?.use === 'commercial';
  const firstNormal = section.floors.find(floor => floor.kind === 'normal');
  const projection = section.projection ?? settings?.projection ?? 'none';
  const roofShape = section.roofShape ?? 'pitched';
  let nextY = headerHeight;
  const layout = section.floors.map(floor => {
    const isolation = hasIsolation && floor.id === 'basement-1';
    const top = nextY + (isolation ? isolationHeight : 0);
    const trade = settings?.use === 'commercial' || (floor.kind === 'ground' && commercialGround) || floor.units.some(unit => unit.type === 'shop');
    const height = floor.kind === 'roof' ? roofHeights[roofShape] : trade || (floor.kind === 'ground' && settings?.mezzanine) ? 71 : rowHeight;
    nextY = top + height;
    const setback = Boolean(settings?.stepped && floor.id === firstNormal?.id);
    const inset = !(floor.kind === 'basement' && floor.service) && (floor.inset || setback);
    const rowWidth = inset ? buildingWidth * .86 : buildingWidth;
    return { floor, top, height, isolation, inset, setback, rowWidth, x: setback ? left : left + (buildingWidth - rowWidth) / 2 };
  });
  const ground = layout.find(row => row.floor.kind === 'ground');
  const roofBase = layout.find(row => row.floor.kind === 'normal') ?? ground;
  const firstBasement = layout.find(row => row.floor.id === 'basement-1');
  const grade = ground ? ground.top + ground.height : firstBasement?.top ?? nextY;
  const exteriorTop = layout.find(row => row.floor.kind !== 'roof')?.top ?? headerHeight;
  const right = left + buildingWidth;
  const height = nextY + 14;
  const handleKey = (event: KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  function drawUnits(floor: SectionFloor, x: number, top: number, rowWidth: number, height: number) {
    const unitWidth = rowWidth / floor.units.length;
    return floor.units.map((unit, index) => {
      const unitX = x + index * unitWidth;
      const center = unitX + unitWidth / 2;
      const action = onUnit ? () => onUnit(unit, floor) : null;
      const suffix = unit.type === 'duplex' ? ' (DUBLEKS)' : '';
      const baseTitle = suffix ? unit.title.replace(/\s*\(DUBLEKS\)\s*$/iu, '') : unit.title;
      const fullTitle = baseTitle + suffix;
      const title = shortened(baseTitle, Math.max(30, Math.floor(unitWidth / 4.5)) - suffix.length) + suffix;
      const gross = `BRÜT: ${area(unit.gross)}`;
      const generalGross = `GENEL BRÜT: ${area(unit.totalGross)}`;
      const textTop = top + height - rowHeight;
      return <g key={unit.id} data-unit={unit.id} data-contractor-share={unit.isContractorShare} aria-label={action ? `${floor.label}, ${fullTitle} düzenle` : undefined} role={action ? 'button' : undefined} tabIndex={action ? 0 : undefined} onClick={action ?? undefined} onKeyDown={action ? event => handleKey(event, action) : undefined} className={action ? 'section-interactive' : undefined}>
        <title>{`${fullTitle} · Brüt ${area(unit.gross)} · Genel brüt ${area(unit.totalGross)}`}</title>
        {unit.isContractorShare && <rect x={unitX} y={top} width={unitWidth} height={height} fill={`url(#${hatch})`} />}
        {index > 0 && <path d={`M${unitX} ${top}v${height}`} fill="none" stroke="#000" strokeWidth=".75" />}
        <rect x={unitX + 1} y={top + 1} width={unitWidth - 2} height={height - 2} fill="transparent" className="section-hitbox" />
        {unit.roofArrow && <path data-roof-arrow="" d={`M${center} ${top + 9}v-16m-4 4 4-4 4 4`} stroke="#000" strokeWidth=".9" fill="none" />}
        <text x={center} y={textTop + 18} textAnchor="middle" className="section-unit-title section-ink" {...fit(title, unitWidth - 8, 6.5)}>{title}</text>
        <text x={center} y={textTop + 32} textAnchor="middle" className="section-unit-value section-ink" {...fit(gross, unitWidth - 8, 5.1)}>{gross}</text>
        <text x={center} y={textTop + 45} textAnchor="middle" className="section-unit-value section-ink" {...fit(generalGross, unitWidth - 8, 5.1)}>{generalGross}</text>
      </g>;
    });
  }

  function drawRoof(floor: SectionFloor, top: number, height: number) {
    const x = roofBase?.x ?? left;
    const roofWidth = roofBase?.rowWidth ?? buildingWidth;
    const end = x + roofWidth;
    const center = x + roofWidth / 2;
    const bottom = top + height;
    const shoulderInset = roofWidth * .11;
    const label = roofShape === 'terrace' ? 'TERAS / YEŞİL ÇATI'
      : roofShape === 'mansard' ? 'KÖR ÇATI' : 'KÖR ÇATI (ORTAK ALAN)';

    return <g data-roof={roofShape} data-roof-usage={section.roofUsage}>
      {roofShape === 'terrace'
        ? <g fill="none" stroke="#000" strokeWidth="1.1">
          <path d={`M${x} ${bottom - 22}V${bottom}H${end}V${bottom - 22} M${x} ${bottom - 4}H${end}`} />
          <text x={end - 7} y={bottom - 13} textAnchor="end" className="section-unit-value" fill="#000" stroke="none">1,10 m</text>
        </g>
        : <polygon fill="#fff" stroke="#000" strokeWidth="1.1" points={roofShape === 'mansard'
          ? `${x},${bottom} ${x + shoulderInset},${top + 24} ${center},${top + 5} ${end - shoulderInset},${top + 24} ${end},${bottom}`
          : `${x},${bottom} ${center},${top + 5} ${end},${bottom}`} />}
      {(section.roofUsage === 'cold' || roofShape === 'terrace') && (
        <text x={center} y={bottom - (roofShape === 'terrace' ? 13 : 11)} textAnchor="middle" className="section-unit-title">{label}</text>
      )}
      {floor.units.length > 0 && <g>
        <rect x={x + shoulderInset} y={bottom - rowHeight} width={roofWidth - 2 * shoulderInset} height={rowHeight} fill="#fff" stroke="#000" strokeWidth="1.1" />
        {drawUnits(floor, x + shoulderInset, bottom - rowHeight, roofWidth - 2 * shoulderInset, rowHeight)}
      </g>}
    </g>;
  }

  return <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin meet" aria-label="Şematik bina kesiti" className="section-svg">
    <defs>
      <pattern id={hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V8" fill="none" stroke="#000" strokeWidth=".6" />
      </pattern>
      <pattern id={dots} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="3" cy="3" r=".75" fill="#000" />
      </pattern>
    </defs>
    <rect width={width} height={height} fill="#fff" />
    {Array.from({ length: design.columns }, (_, index) => {
      const heading = design.headings[index]?.trim() || defaultHeading(index);
      const caption = shortened(heading, Math.max(12, Math.floor(142 / design.columns)));
      return <g key={index}><title>{heading}</title>
        <text x={left + buildingWidth * (index + .5) / design.columns} y="27" textAnchor="middle" className="section-facade" {...fit(caption, buildingWidth / design.columns - 8, 7.8)}>{caption}</text>
      </g>;
    })}
    {layout.map(({ floor, top, height, rowWidth, x, inset, isolation, setback }) => {
      const y = top + height / 2;
      const clickable = floor.service && onFloor ? () => onFloor(floor) : null;
      const serviceLabel = floor.serviceLabel || design.serviceTitle?.trim() || 'OTOPARK / SIĞINAK';
      const mezzanine = floor.kind === 'ground' && settings?.mezzanine;
      const balcony = floor.kind === 'normal' && (projection === 'open' || projection === 'mixed');
      const center = left + buildingWidth / 2;

      return <g key={floor.id} data-floor={floor.id} data-inset={inset} data-setback={setback} data-contractor={floor.units.some(unit => unit.isContractorShare)}>
        {isolation && <g data-isolation-band="">
          <rect x={left} y={top - isolationHeight} width={buildingWidth} height={isolationHeight} fill={`url(#${dots})`} stroke="#000" strokeWidth=".8" />
          <text x={center} y={top - 8} textAnchor="middle" className="section-unit-title section-ink">DEPREM YALITIM KATI (≤ 2,40 m)</text>
        </g>}
        <text x="2" y={y + 4} className="section-floor-label">{floor.label}</text>
        <path d={`M${left - 20} ${y}h11`} stroke="#000" strokeWidth=".55" />
        {floor.kind === 'roof'
          ? drawRoof(floor, top, height)
          : <g>
              <rect x={x} y={top} width={rowWidth} height={height} fill="#fff" stroke="#000" strokeWidth="1.1" />
              {floor.service
                ? <g aria-label={clickable ? `${floor.label}, ${serviceLabel} alanını düzenle` : undefined} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onClick={clickable ?? undefined} onKeyDown={clickable ? event => handleKey(event, clickable) : undefined} className={clickable ? 'section-interactive' : undefined}>
                    <rect x={x} y={top} width={rowWidth} height={height} fill="transparent" className="section-hitbox" />
                    <text x={x + rowWidth / 2} y={y + (mezzanine ? 6 : -3)} textAnchor="middle" className="section-unit-title section-ink" {...fit(serviceLabel, rowWidth - 16, 6.5)}>{serviceLabel}</text>
                    <text x={x + rowWidth / 2} y={y + (mezzanine ? 21 : 12)} textAnchor="middle" className="section-unit-value section-ink">BRÜT: {area(floor.area)}</text>
                  </g>
                : drawUnits(floor, x, top, rowWidth, height)}
              {balcony && <path data-balcony-divisions="" d={`M${x + 12} ${top}v${height} M${x + rowWidth - 12} ${top}v${height}`} fill="none" stroke="#000" strokeWidth=".7" strokeDasharray="3 3" pointerEvents="none" />}
              {mezzanine && <g data-mezzanine="" pointerEvents="none">
                <path d={`M${x} ${top + height / 3}h${rowWidth}`} fill="none" stroke="#000" strokeWidth=".7" />
                <text x={x + 12} y={top + 15} className="section-unit-value section-ink">ASMA KAT</text>
              </g>}
              {floor.kind === 'ground' && (projection === 'column' || settings?.portico) && <g data-ground-columns="" fill="#fff" stroke="#000" strokeWidth=".8" pointerEvents="none">
                <rect x={projection === 'column' ? left + 7 : x + 6} y={top} width="5" height={height} />
                <rect x={projection === 'column' ? right - 12 : x + rowWidth - 11} y={top} width="5" height={height} />
              </g>}
              {excess && floor.id === (firstNormal?.id ?? ground?.floor.id) && <rect data-excess-frame="" x={x} y={top} width={rowWidth} height={height} fill="none" stroke="#b91c1c" strokeWidth="2.4" strokeDasharray="7 4" pointerEvents="none" />}
            </g>}
      </g>;
    })}
    {settings && <g data-building-order={settings.order} stroke="#000" fill="none" pointerEvents="none">
      <path d={`M${left - 7} ${exteriorTop}V${nextY}`} strokeWidth={settings.order === 'detached' ? '.55' : '3'} strokeDasharray={settings.order === 'detached' ? '5 3' : undefined} />
      <path d={`M${right + 7} ${exteriorTop}V${nextY}`} strokeWidth={settings.order === 'attached' ? '3' : '.55'} strokeDasharray={settings.order === 'attached' ? undefined : '5 3'} />
    </g>}
    {settings && <g data-grade={sloped ? 'sloped' : 'level'} pointerEvents="none">
      <path d={sloped ? `M${left - 16} ${grade - 14}L${right + 10} ${Math.min(grade + 23, height - 3)}` : `M${left - 16} ${grade}H${right + 10}`} stroke="#000" strokeWidth={sloped ? '.75' : '1.1'} strokeDasharray={sloped ? '6 4' : undefined} />
      <text x={left - 46} y={grade + (sloped ? -17 : 5)} className="section-unit-value section-ink">±0,00</text>
    </g>}
  </svg>;
}

function AreaTable({ floors, total, onFloor, compact = false }: { floors: SectionFloor[]; total: number | null; onFloor?: SheetProps['onFloor']; compact?: boolean }) {
  return <table className="section-area-table">
    {!compact && <caption>Özet metraj</caption>}
    <thead><tr><th scope="col">Kat</th><th scope="col">{compact ? 'm²' : 'İnşaat alanı'}</th></tr></thead>
    <tbody>
      {floors.map(floor => <tr key={floor.id}>
        <th scope="row">{onFloor && (floor.kind !== 'roof' || floor.units.length > 0) ? <button type="button" aria-label={`${floor.label} alanını düzenle`} onClick={() => onFloor(floor)}>{floor.label}<span aria-hidden="true"> ↗</span></button> : floor.label}</th>
        <td>{compact && floor.area !== null ? squareMetres.format(floor.area) : area(floor.area)}</td>
      </tr>)}
    </tbody>
    {!compact && <tfoot><tr><th scope="row">TOPLAM</th><td>{area(total)}</td></tr></tfoot>}
  </table>;
}

function Metraj({ section, print, onFloor }: { section: Section; print?: boolean; onFloor?: SheetProps['onFloor'] }) {
  if (!print || section.floors.length <= 17) return <AreaTable floors={section.floors} total={section.totalArea} onFloor={onFloor} />;
  const count = Math.min(4, Math.max(2, Math.ceil(section.floors.length / 32)));
  const perColumn = Math.ceil(section.floors.length / count);
  return <div className="section-compact-summary" data-column-count={count} data-dense={section.floors.length > 130}>
    <h4>Özet metraj</h4>
    <div className="section-compact-tables" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
      {Array.from({ length: count }, (_, i) => <AreaTable key={i} floors={section.floors.slice(i * perColumn, (i + 1) * perColumn)} total={section.totalArea} compact />)}
    </div>
    <p>TOPLAM <span>{area(section.totalArea)}</span></p>
  </div>;
}

function Legend() {
  return <span className="section-legend">
    <svg width="24" height="15" viewBox="0 0 24 15" aria-hidden="true">
      <rect x=".5" y=".5" width="23" height="14" fill="#fff" stroke="#000" />
      <path d="M1 5L5 1M1 11L11 1M4 14L17 1M10 14L23 1M16 14L23 7M22 14L23 13" stroke="#000" strokeWidth=".65" />
    </svg>
    MÜTEAHHİT PAYI
  </span>;
}

function SheetHeader({ project, printDate, title }: { project: Project; printDate?: string; title: string }) {
  const place = [project.semt, project.mahalle].filter(Boolean).join(' / ');
  const parcel = [project.ada != null && project.ada !== '' ? `${project.ada} Ada` : '', project.parsel != null && project.parsel !== '' ? `${project.parsel} Parsel` : ''].filter(Boolean).join(' · ');
  return <div className="section-sheet-heading">
    <div><h3>{title}</h3><p>{[place, parcel].filter(Boolean).join(' · ') || 'Ada / parsel bilgisi girilmedi'}</p></div>
    {printDate !== undefined && <div className="section-contact"><p>www.asdemyapi.com</p><p>+90 (532) 664 47 25</p></div>}
    {printDate !== undefined && <p className="section-print-date">{printDate}</p>}
    <p>Şematik · Ölçeksiz</p>
  </div>;
}

function PrintFooter() {
  return <div className="section-print-footer">
    <p>Ön çalışmadır. Kesin metrekare hesapları değildir. Kanıt olarak kullanılamaz.</p>
    <div className="section-company-logo"><img src="/asdem-logo.png" alt="Asdem Yapı Construction" /></div>
  </div>;
}

function SheetBody({ project, design, section, onUnit, onFloor, report, sloped, printDate }: SheetProps & { printDate?: string }) {
  const print = printDate !== undefined;
  return <div className={print ? 'section-sheet section-print-page' : 'section-sheet'} data-section-sheet="">
    <SheetHeader project={project} title="Şematik Bina Kesiti" printDate={printDate} />
    {section.floors.length ? <div className="section-sheet-content">
      <div className="section-illustration">
        <div className="section-drawing"><Drawing design={design} section={section} onUnit={onUnit} onFloor={onFloor} settings={report?.settings} sloped={sloped} excess={!print && (report?.evaluation.calculations.emsalExcess ?? 0) > 0} /></div>
        <Legend />
      </div>
      <Metraj section={section} print={print} onFloor={onFloor} />
    </div> : <p className="section-empty">Kesit oluşturmak için bina ayarlarından bir kat ekleyin.</p>}
    {print && <PrintFooter />}
  </div>;
}

function NotesPage({ project, report, section, date }: { project: Project; report: SheetReport; section: Section; date: string }) {
  const { calculations, legalNotes } = report.evaluation;
  const categories = [...new Set(legalNotes.map(note => note.category))];
  const metrics = [
    ['Arsa alanı', area(typeof project.arsa_alani === 'number' ? project.arsa_alani : null)],
    ['TAKS / KAKS', `${project.taks ?? '—'} / ${project.kaks ?? '—'}`],
    ['Toplam inşaat alanı', area(section.totalArea)],
    ['Net emsal alanı', area(calculations.netEmsal)],
    ['%30 emsal harici havuz', area(calculations.bonusPool)],
    ['Emsal dışında öngörülen alan', area(calculations.exemptArea)],
    ['Emsal aşımı', area(calculations.emsalExcess)],
    ['Bahçe mesafesi artışı', calculations.setbackIncrease == null ? '—' : `${squareMetres.format(calculations.setbackIncrease)} m`],
    ['Ağaç ihtiyacı', calculations.treeCount == null ? '—' : String(calculations.treeCount)],
  ];
  return <div className="section-sheet section-print-page section-notes-page" data-section-notes="" data-dense={report.parameters.length > 14 || legalNotes.length > 13}>
    <SheetHeader project={project} title="MİMARİ SENARYO & MEVZUAT TEKNİK NOTLARI" printDate={date} />
    <div className="section-notes-body">
      <div className="section-notes-summary">
        <h4>Seçilen Senaryo Parametreleri</h4>
        <dl>{report.parameters.map(([name, value], i) => <div key={i}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        <h4>Alan, Emsal ve Paylaşım Özeti</h4>
        <dl>{metrics.map(([name, value]) => <div key={name}><dt>{name}</dt><dd>{value}</dd></div>)}</dl>
        <table className="section-shares-table">
          <thead><tr><th scope="col">Pay</th><th scope="col">Adet</th><th scope="col">Alan</th><th scope="col">Yüzde</th></tr></thead>
          <tbody>{([['Arsa Sahibi', calculations.owner], ['Müteahhit', calculations.contractor]] as const).map(([label, share]) =>
            <tr key={label}><th scope="row">{label}</th><td>{share.count}</td><td>{area(share.area)}</td><td>{share.percent == null ? '—' : `% ${squareMetres.format(share.percent)}`}</td></tr>,
          )}</tbody>
        </table>
      </div>
      <div className="section-legal-notes">
        <h4>Mevzuat Değerlendirmesi ve Teknik Notlar</h4>
        {categories.length ? categories.map(category => <section key={category}>
          <h5>{category}</h5>
          <ul>{legalNotes.filter(note => note.category === category).map(note => <li key={note.id}><strong>{note.severity === 'critical' ? 'Kritik' : note.severity === 'warning' ? 'Uyarı' : 'Bilgi'}</strong> {note.message}</li>)}</ul>
        </section>) : <p>Bu senaryo için teknik uyarı bulunmuyor.</p>}
      </div>
    </div>
    <PrintFooter />
  </div>;
}

function currentPrintDate() {
  return new Intl.DateTimeFormat('tr-TR', { timeZone: 'Europe/Istanbul', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date());
}

export function SectionSheet({ project, design, section, onUnit, onFloor, print = false, report, includeNotes = true, sloped }: SheetProps) {
  const [printDate, setPrintDate] = useState('');
  useEffect(() => {
    if (!print) return;
    setPrintDate(currentPrintDate());
    const updateDate = () => flushSync(() => setPrintDate(currentPrintDate()));
    window.addEventListener('beforeprint', updateDate);
    return () => window.removeEventListener('beforeprint', updateDate);
  }, [print]);
  if (!print) return <SheetBody project={project} design={design} section={section} onUnit={onUnit} onFloor={onFloor} report={report} sloped={sloped} />;
  return <div className="section-print-layout" aria-hidden="true">
    <SheetBody project={project} design={design} section={section} report={report} sloped={sloped} printDate={printDate} />
    {includeNotes && report && <NotesPage project={project} report={report} section={section} date={printDate} />}
  </div>;
}
