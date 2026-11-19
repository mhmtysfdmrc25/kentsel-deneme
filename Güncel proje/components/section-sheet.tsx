'use client';

import { useId, type KeyboardEvent } from 'react';
import type { Project } from '@/lib/projects';
import { defaultHeading, type BuildingDesign, type Section, type SectionFloor, type SectionUnit } from '@/lib/simulator';

type SheetProps = {
  project: Project;
  design: BuildingDesign;
  section: Section;
  onUnit?: (unit: SectionUnit, floor: SectionFloor) => void;
  onFloor?: (floor: SectionFloor) => void;
  print?: boolean;
};

const width = 760;
const left = 155;
const buildingWidth = 592;
const headerHeight = 49;
const rowHeight = 53;
const roofHeight = 48;
const rowsPerPage = 12;
const squareMetres = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const area = (value: number | null) => value === null ? '—' : `${squareMetres.format(value)} m²`;

function shortened(value: string, limit: number) {
  const characters = Array.from(value);
  return characters.length > limit ? `${characters.slice(0, limit - 1).join('')}…` : value;
}

function fit(value: string, available: number, characterWidth: number) {
  return value.length * characterWidth > available ? { textLength: available, lengthAdjust: 'spacingAndGlyphs' as const } : {};
}

function Drawing({ design, floors, onUnit, onFloor }: {
  design: BuildingDesign;
  floors: SectionFloor[];
  onUnit?: SheetProps['onUnit'];
  onFloor?: SheetProps['onFloor'];
}) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const hatch = `kesit-tarama-${id}`;
  const height = headerHeight + floors.reduce((total, floor) => total + (floor.kind === 'roof' ? roofHeight : rowHeight), 0) + 8;
  let nextY = headerHeight;
  const handleKey = (event: KeyboardEvent<SVGGElement>, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };

  return <svg viewBox={`0 0 ${width} ${height}`} aria-label="Şematik bina kesiti" className="section-svg">
    <defs>
      <pattern id={hatch} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <path d="M0 0V8" fill="none" stroke="#000" strokeWidth=".6" />
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
    {floors.map(floor => {
      const top = nextY;
      const height = floor.kind === 'roof' ? roofHeight : rowHeight;
      nextY += height;
      const rowWidth = floor.inset && !floor.service ? buildingWidth * .86 : buildingWidth;
      const x = left + (buildingWidth - rowWidth) / 2;
      const y = top + height / 2;
      const clickable = floor.service && onFloor ? () => onFloor(floor) : null;
      const unitWidth = rowWidth / Math.max(1, floor.units.length);

      return <g key={floor.id} data-floor={floor.id} data-inset={floor.inset && !floor.service} data-contractor={floor.contractor}>
        <text x="2" y={y + 4} className="section-floor-label">{floor.label}</text>
        <path d={`M${left - 20} ${y}h11`} stroke="#000" strokeWidth=".55" />
        {floor.kind === 'roof'
          ? <polygon data-roof="" points={`${left},${top + height} ${left + buildingWidth / 2},${top + 5} ${left + buildingWidth},${top + height}`} fill="#fff" stroke="#000" strokeWidth="1.1" />
          : <g>
              <rect x={x} y={top} width={rowWidth} height={height} fill={floor.contractor ? `url(#${hatch})` : '#fff'} stroke="#000" strokeWidth="1.1" />
              {floor.service
                ? <g aria-label={clickable ? `${floor.label} otopark / sığınak alanını düzenle` : undefined} role={clickable ? 'button' : undefined} tabIndex={clickable ? 0 : undefined} onClick={clickable ?? undefined} onKeyDown={clickable ? event => handleKey(event, clickable) : undefined} className={clickable ? 'section-interactive' : undefined}>
                    <rect x={x} y={top} width={rowWidth} height={height} fill="transparent" className="section-hitbox" />
                    <text x={x + rowWidth / 2} y={y + 4} textAnchor="middle" className="section-unit-title section-ink">OTOPARK / SIĞINAK</text>
                  </g>
                : floor.units.map((unit, index) => {
                    const unitX = x + index * unitWidth;
                    const center = unitX + unitWidth / 2;
                    const action = onUnit ? () => onUnit(unit, floor) : null;
                    const suffix = unit.type === 'duplex' ? ' (DUBLEKS)' : '';
                    const baseTitle = suffix ? unit.title.replace(/\s*\(DUBLEKS\)\s*$/iu, '') : unit.title;
                    const fullTitle = baseTitle + suffix;
                    const title = shortened(baseTitle, Math.max(30, Math.floor(unitWidth / 4.5)) - suffix.length) + suffix;
                    const gross = `BRÜT: ${area(unit.gross)}`;
                    const generalGross = `GENEL BRÜT: ${area(unit.totalGross)}`;
                    return <g key={unit.id} data-unit={unit.id} aria-label={action ? `${floor.label}, ${fullTitle} düzenle` : undefined} role={action ? 'button' : undefined} tabIndex={action ? 0 : undefined} onClick={action ?? undefined} onKeyDown={action ? event => handleKey(event, action) : undefined} className={action ? 'section-interactive' : undefined}>
                      <title>{fullTitle} · Brüt {area(unit.gross)} · Genel brüt {area(unit.totalGross)}</title>
                      {index > 0 && <path d={`M${unitX} ${top}v${height}`} fill="none" stroke="#000" strokeWidth=".75" />}
                      <rect x={unitX + 1} y={top + 1} width={unitWidth - 2} height={height - 2} fill="transparent" className="section-hitbox" />
                      {unit.roofArrow && <path data-roof-arrow="" d={`M${center} ${top + 9}v-16m-4 4 4-4 4 4`} stroke="#000" strokeWidth=".9" fill="none" />}
                      <text x={center} y={top + 18} textAnchor="middle" className="section-unit-title section-ink" {...fit(title, unitWidth - 8, 6.5)}>{title}</text>
                      <text x={center} y={top + 32} textAnchor="middle" className="section-unit-value section-ink" {...fit(gross, unitWidth - 8, 5.1)}>{gross}</text>
                      <text x={center} y={top + 45} textAnchor="middle" className="section-unit-value section-ink" {...fit(generalGross, unitWidth - 8, 5.1)}>{generalGross}</text>
                    </g>;
                  })}
            </g>}
      </g>;
    })}
  </svg>;
}

function AreaTable({ floors, total, onFloor }: { floors: SectionFloor[]; total: number | null; onFloor?: SheetProps['onFloor'] }) {
  return <table className="section-area-table">
    <caption>Özet metraj</caption>
    <thead><tr><th scope="col">Kat</th><th scope="col">İnşaat alanı</th></tr></thead>
    <tbody>
      {floors.map(floor => <tr key={floor.id}>
        <th scope="row">{onFloor ? <button type="button" aria-label={`${floor.label} alanını düzenle`} onClick={() => onFloor(floor)}>{floor.label}<span aria-hidden="true"> ↗</span></button> : floor.label}</th>
        <td>{area(floor.area)}</td>
      </tr>)}
    </tbody>
    <tfoot><tr><th scope="row">TOPLAM</th><td>{area(total)}</td></tr></tfoot>
  </table>;
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

function SheetBody({ project, design, section, floors, onUnit, onFloor, page }: Omit<SheetProps, 'print'> & {
  floors: SectionFloor[];
  page?: { index: number; count: number };
}) {
  const place = [project.semt, project.mahalle].filter(Boolean).join(' / ');
  const parcel = [project.ada != null && project.ada !== '' ? `${project.ada} Ada` : '', project.parsel != null && project.parsel !== '' ? `${project.parsel} Parsel` : ''].filter(Boolean).join(' · ');
  return <div className={page ? 'section-sheet section-print-page' : 'section-sheet'} data-section-sheet="">
    <div className="section-sheet-heading">
      <div><h3>Şematik Bina Kesiti</h3><p>{[place, parcel].filter(Boolean).join(' · ') || 'Ada / parsel bilgisi girilmedi'}</p></div>
      <p>{page && page.count > 1 ? `Pafta ${page.index + 1} / ${page.count}` : 'Şematik · Ölçeksiz'}</p>
    </div>
    {floors.length ? <div className="section-sheet-content">
      <div className="section-illustration">
        <div className="section-drawing"><Drawing design={design} floors={floors} onUnit={onUnit} onFloor={onFloor} /></div>
        <Legend />
      </div>
      <AreaTable floors={floors} total={section.totalArea} onFloor={onFloor} />
    </div> : <p className="section-empty">Kesit oluşturmak için bina ayarlarından bir kat ekleyin.</p>}
  </div>;
}

export function SectionSheet({ project, design, section, onUnit, onFloor, print = false }: SheetProps) {
  if (!print) return <SheetBody project={project} design={design} section={section} floors={section.floors} onUnit={onUnit} onFloor={onFloor} />;

  const count = Math.max(1, Math.ceil(section.floors.length / rowsPerPage));
  return <div className="section-print-layout" aria-hidden="true">
    {Array.from({ length: count }, (_, index) => (
      <SheetBody key={index} project={project} design={design} section={section} floors={section.floors.slice(index * rowsPerPage, (index + 1) * rowsPerPage)} page={{ index, count }} />
    ))}
  </div>;
}
