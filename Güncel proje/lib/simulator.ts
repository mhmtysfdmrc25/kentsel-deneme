import type { Project } from './projects';
import { validateScenario, type Scenario } from './scenario.ts';

export const MAX_SECTION_FLOORS = 100;
export const MAX_SECTION_COLUMNS = 6;
export const MAX_SECTION_HEADING_LENGTH = 30;
export const MAX_SECTION_TITLE_LENGTH = 60;
export const MAX_SECTION_AREA = 1_000_000_000;

export type UnitType = 'apartment' | 'shop' | 'duplex';
export type UnitOverride = { title?: string; type?: UnitType; gross?: number; totalGross?: number };
export type BuildingDesign = {
  normalFloors: number;
  ground: boolean;
  basementFloors: number;
  serviceBasement: boolean;
  columns: number;
  headings: string[];
  duplex: boolean;
  contractorFloors: string[];
  floorAreas: Record<string, number>;
  units: Record<string, UnitOverride>;
};
export type SimulatorScenario = Scenario & { design?: BuildingDesign };

export type SectionUnit = { id: string; title: string; type: UnitType; gross: number | null; totalGross: number | null; roofArrow: boolean };
export type SectionFloor = {
  id: string;
  label: string;
  kind: 'roof' | 'normal' | 'ground' | 'basement';
  service: boolean;
  inset: boolean;
  contractor: boolean;
  area: number | null;
  units: SectionUnit[];
};
export type Section = { floors: SectionFloor[]; totalArea: number | null; totalUnits: number; totalFloors: number };

export function emptyDesign(): BuildingDesign {
  return {
    normalFloors: 6, ground: true, basementFloors: 2, serviceBasement: true,
    columns: 2, headings: ['ÖN CEPHE', 'ARKA CEPHE'], duplex: false,
    contractorFloors: [], floorAreas: {}, units: {},
  };
}

export function defaultHeading(index: number): string {
  if (index === 0) return 'ÖN CEPHE';
  if (index === 1) return 'ARKA CEPHE';
  return `${index + 1}. CEPHE`;
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Geçersiz kesit verisi.');
  return value as Record<string, unknown>;
}

function count(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} ${min} ile ${max} arasında bir tam sayı olmalıdır.`);
  }
  return value;
}

function flag(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Kesit seçimleri geçersiz.');
  return value;
}

function labelText(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max || /[\r\n]/u.test(value)) throw new Error(`Kesit başlıkları en fazla ${max} karakterli ve tek satır olmalıdır.`);
  return value.trim();
}

function areaValue(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_SECTION_AREA) throw new Error('Kesit alanı sıfır ile 1.000.000.000 m² arasında olmalıdır.');
  return value;
}

function floorId(id: unknown, roofAllowed = true): id is string {
  if (typeof id !== 'string') return false;
  if (id === 'ground' || (roofAllowed && id === 'roof')) return true;
  const match = /^(?:normal|basement)-([1-9]\d*)$/u.exec(id);
  return !!match && Number(match[1]) <= MAX_SECTION_FLOORS;
}

export function validateDesign(value: unknown): BuildingDesign {
  const data = record(value);
  const normalFloors = count(data.normalFloors, 0, MAX_SECTION_FLOORS, 'Normal kat sayısı');
  const basementFloors = count(data.basementFloors, 0, MAX_SECTION_FLOORS, 'Bodrum kat sayısı');
  const columns = count(data.columns, 1, MAX_SECTION_COLUMNS, 'Sütun sayısı');
  if (!Array.isArray(data.headings) || data.headings.length > MAX_SECTION_COLUMNS) throw new Error('Cephe başlıkları geçersiz.');
  const headings = data.headings.map(value => labelText(value, MAX_SECTION_HEADING_LENGTH));
  if (!Array.isArray(data.contractorFloors) || !data.contractorFloors.every(id => floorId(id, false))) throw new Error('Müteahhit katları geçersiz.');
  const contractorFloors = [...new Set<string>(data.contractorFloors)];
  const floorAreas: BuildingDesign['floorAreas'] = {};
  for (const [key, value] of Object.entries(record(data.floorAreas))) {
    if (!floorId(key)) throw new Error('Kat metrajı geçersiz.');
    floorAreas[key] = areaValue(value);
  }
  const units: BuildingDesign['units'] = {};
  for (const [key, value] of Object.entries(record(data.units))) {
    const match = /^(.+):([0-5])$/u.exec(key);
    if (!match || !floorId(match[1], false)) throw new Error('Bağımsız bölüm kimliği geçersiz.');
    const unit = record(value);
    const override: UnitOverride = {};
    if (unit.title !== undefined) override.title = labelText(unit.title, MAX_SECTION_TITLE_LENGTH);
    if (unit.type !== undefined) {
      if (unit.type !== 'apartment' && unit.type !== 'shop' && unit.type !== 'duplex') throw new Error('Bağımsız bölüm tipi geçersiz.');
      override.type = unit.type;
    }
    if (unit.gross !== undefined) override.gross = areaValue(unit.gross);
    if (unit.totalGross !== undefined) override.totalGross = areaValue(unit.totalGross);
    if (override.gross !== undefined && override.totalGross !== undefined && override.gross > override.totalGross) {
      throw new Error('Bağımsız bölümün genel brüt alanı brüt alanından küçük olamaz.');
    }
    if (Object.keys(override).length) units[key] = override;
  }
  return {
    normalFloors, ground: flag(data.ground), basementFloors, serviceBasement: flag(data.serviceBasement),
    columns, headings, duplex: flag(data.duplex), contractorFloors, floorAreas, units,
  };
}

export function validateSimulator(value: unknown): SimulatorScenario {
  const scenario = validateScenario(value);
  const { design } = record(value);
  return design === undefined ? scenario : { ...scenario, design: validateDesign(design) };
}

function areaProduct(a: unknown, b: unknown): number | null {
  if (typeof a !== 'number' || typeof b !== 'number' || a < 0 || b < 0) return null;
  const result = a * b;
  return Number.isFinite(result) ? result : null;
}

export function deriveSection(project: Project, scenario: Scenario, design: BuildingDesign): Section {
  const { normalFloors, ground, basementFloors, serviceBasement, columns, duplex } = design;
  const floorCount = normalFloors + Number(ground) + basementFloors;
  const roofExists = duplex && normalFloors > 0;
  const availableUnits = floorCount - Number(serviceBasement && basementFloors > 0);
  const footprint = areaProduct(project.arsa_alani, project.taks);
  const emsal = areaProduct(project.arsa_alani, project.kaks);
  const defaultArea = footprint ?? (emsal === null || floorCount === 0 ? null : emsal / floorCount);
  const selected = new Set(design.contractorFloors);
  const floors: SectionFloor[] = [];

  function addFloor(id: string, label: string, kind: SectionFloor['kind'], order: number, service = false, inset = false) {
    const floorOverride = design.floorAreas[id];
    const estimatedArea = floorOverride ?? (kind === 'roof' ? 0 : defaultArea);
    const unitArea = estimatedArea === null ? null : estimatedArea / columns;
    const units: SectionUnit[] = [];
    if (kind !== 'roof' && !service) {
      for (let column = 0; column < columns; column++) {
        const unitId = `${id}:${column}`;
        const override = design.units[unitId];
        const type = override?.type ?? (roofExists && id === `normal-${normalFloors}` ? 'duplex' : 'apartment');
        const number = order * columns + column + 1;
        const defaultTitle = `${number} NOLU ${type === 'shop' ? 'DÜKKAN' : 'DAİRE'}`;
        const title = override?.title || defaultTitle;
        const gross = override?.gross ?? unitArea;
        units.push({ id: unitId, title, type, gross, totalGross: override?.totalGross ?? gross, roofArrow: roofExists && id === `normal-${normalFloors}` && type === 'duplex' });
      }
    }
    const derivedArea = units.length === 0 ? estimatedArea : units.every(unit => unit.gross !== null)
      ? units.reduce((sum, unit) => sum + unit.gross!, 0) : null;
    floors.push({ id, label, kind, service, inset: inset && !service, contractor: !service && kind !== 'roof' && selected.has(id), area: floorOverride ?? derivedArea, units });
  }

  if (roofExists) addFloor('roof', 'ÇATI ARASI PİYESİ', 'roof', 0);
  const residentialBasementCount = basementFloors - Number(serviceBasement && basementFloors > 0);
  for (let floor = normalFloors; floor > 0; floor--) {
    addFloor(`normal-${floor}`, `${floor}. NORMAL KAT`, 'normal', residentialBasementCount + Number(ground) + floor - 1);
  }
  if (ground) addFloor('ground', 'ZEMİN KAT', 'ground', residentialBasementCount, false, scenario.projection);
  for (let floor = 1; floor <= basementFloors; floor++) {
    const service = serviceBasement && floor === basementFloors;
    addFloor(`basement-${floor}`, `${floor}. BODRUM KAT`, 'basement', residentialBasementCount - floor, service, scenario.projection && floor === 1);
  }
  const totalArea = floorCount > 0 && floors.every(floor => floor.area !== null) ? floors.reduce((sum, floor) => sum + floor.area!, 0) : null;
  return { floors, totalArea, totalUnits: availableUnits * columns, totalFloors: floorCount };
}
