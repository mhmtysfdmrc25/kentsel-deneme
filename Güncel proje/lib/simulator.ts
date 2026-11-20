import type { Project } from './projects';
import { locksFor, normalizeRuleSettings, validateRuleSettings, type RuleSettings } from './imarRules.ts';
import { validateScenario, type Scenario } from './scenario.ts';

export const MAX_SECTION_FLOORS = 100;
export const MAX_SECTION_COLUMNS = 6;
export const MAX_SECTION_HEADING_LENGTH = 30;
export const MAX_SECTION_TITLE_LENGTH = 60;
export const MAX_SECTION_AREA = 1_000_000_000;

export const UNIT_TYPES = ['apartment', 'shop', 'duplex', 'storage', 'parking'] as const;
export type UnitType = typeof UNIT_TYPES[number];
export type UnitOverride = { title?: string; type?: UnitType; gross?: number; totalGross?: number; net?: number; isContractorShare?: boolean };
export type BuildingDesign = {
  normalFloors: number;
  ground: boolean;
  basementFloors: number;
  serviceBasement: boolean;
  serviceTitle?: string;
  columns: number;
  headings: string[];
  duplex: boolean;
  contractorFloors: string[];
  floorAreas: Record<string, number>;
  units: Record<string, UnitOverride>;
  rules?: RuleSettings;
};
export type SimulatorScenario = Scenario & { design?: BuildingDesign };

export type SectionUnit = {
  id: string;
  title: string;
  type: UnitType;
  allowedTypes: UnitType[];
  net: number | null;
  gross: number | null;
  totalGross: number | null;
  roofArrow: boolean;
  roofArea?: number;
  isContractorShare: boolean;
};
export type SectionFloor = {
  id: string;
  label: string;
  kind: 'roof' | 'normal' | 'ground' | 'basement';
  service: boolean;
  serviceLabel?: string;
  inset: boolean;
  contractor: boolean;
  area: number | null;
  units: SectionUnit[];
};
export type Section = {
  floors: SectionFloor[];
  totalArea: number | null;
  totalUnits: number;
  totalFloors: number;
  projection: RuleSettings['projection'];
  roofShape: RuleSettings['roofShape'] | null;
  roofUsage: RuleSettings['roofUsage'];
};

const unitLabels: Record<UnitType, string> = {
  apartment: 'DAİRE', shop: 'DÜKKAN', duplex: 'DAİRE', storage: 'DEPO', parking: 'OTOPARK',
};
const roofLabels: Record<Section['roofUsage'], string> = {
  cold: 'ÇATI BOŞLUĞU', duplex: 'ÇATI ARASI PİYESİ', independent: 'ÇATI KATI', none: 'TERAS ÇATI',
};
const isResidence = (type: UnitType) => type === 'apartment' || type === 'duplex';
export const isShareableUnit = (type: UnitType) => isResidence(type) || type === 'shop';

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

function floorId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  if (id === 'ground' || id === 'roof') return true;
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
  if (!Array.isArray(data.contractorFloors) || !data.contractorFloors.every(floorId)) throw new Error('Müteahhit katları geçersiz.');
  const contractorFloors = [...new Set<string>(data.contractorFloors)];
  const floorAreas: BuildingDesign['floorAreas'] = {};
  for (const [key, value] of Object.entries(record(data.floorAreas))) {
    if (!floorId(key)) throw new Error('Kat metrajı geçersiz.');
    floorAreas[key] = areaValue(value);
  }
  const units: BuildingDesign['units'] = {};
  for (const [key, value] of Object.entries(record(data.units))) {
    const match = /^(.+):([0-5])$/u.exec(key);
    if (!match || !floorId(match[1])) throw new Error('Bağımsız bölüm kimliği geçersiz.');
    const unit = record(value);
    const override: UnitOverride = {};
    if (unit.title !== undefined) override.title = labelText(unit.title, MAX_SECTION_TITLE_LENGTH);
    if (unit.type !== undefined) {
      if (!UNIT_TYPES.some(type => type === unit.type)) throw new Error('Bağımsız bölüm tipi geçersiz.');
      override.type = unit.type as UnitType;
    }
    if (unit.gross !== undefined) override.gross = areaValue(unit.gross);
    if (unit.net !== undefined) override.net = areaValue(unit.net);
    if (unit.totalGross !== undefined) override.totalGross = areaValue(unit.totalGross);
    if (override.gross !== undefined && override.totalGross !== undefined && override.gross > override.totalGross) {
      throw new Error('Bağımsız bölümün genel brüt alanı brüt alanından küçük olamaz.');
    }
    if (unit.isContractorShare !== undefined) override.isContractorShare = flag(unit.isContractorShare);
    if (Object.keys(override).length) units[key] = override;
  }
  return {
    normalFloors, ground: flag(data.ground), basementFloors, serviceBasement: flag(data.serviceBasement),
    ...(data.serviceTitle === undefined ? {} : { serviceTitle: labelText(data.serviceTitle, MAX_SECTION_TITLE_LENGTH) }),
    ...(data.rules === undefined ? {} : { rules: validateRuleSettings(data.rules, data.duplex === true) }),
    columns, headings, duplex: flag(data.duplex), contractorFloors, floorAreas, units,
  };
}

export function validateSimulator(value: unknown): SimulatorScenario {
  const scenario = validateScenario(value);
  const { design } = record(value);
  return design === undefined ? scenario : { ...scenario, design: validateDesign(design) };
}

export function readSimulator(project: Project): SimulatorScenario | null {
  if (!project.architectural_scenarios) return null;
  try { return validateSimulator(JSON.parse(project.architectural_scenarios)); }
  catch { return null; }
}

function areaProduct(a: unknown, b: unknown): number | null {
  if (typeof a !== 'number' || typeof b !== 'number' || a < 0 || b < 0) return null;
  const result = a * b;
  return Number.isFinite(result) ? result : null;
}

export function deriveSection(project: Project, scenario: Scenario, design: BuildingDesign): Section {
  const { normalFloors, ground, basementFloors, serviceBasement, columns, duplex } = design;
  const rules = design.rules ? normalizeRuleSettings(project, design, design.rules, scenario) : null;
  const locks = rules ? locksFor(project, design, rules, scenario) : null;
  const projection: Section['projection'] = rules?.projection ?? (scenario.projection ? scenario.projectionType || 'open' : 'none');
  const legacyDuplex = !rules && duplex && normalFloors > 0;
  const roofShape = rules && (ground || normalFloors > 0) ? rules.roofShape : legacyDuplex ? 'pitched' : null;
  const roofUsage = roofShape ? rules?.roofUsage ?? 'duplex' : 'none';
  const independentRoof = roofUsage === 'independent';
  const floorCount = normalFloors + Number(ground) + basementFloors + Number(independentRoof);
  const duplexFloor = normalFloors > 0 ? `normal-${normalFloors}` : 'ground';
  const plotFootprint = areaProduct(project.arsa_alani, project.taks);
  const blockFootprint = rules?.regime === 'block' ? areaProduct(rules.blockWidth, rules.blockDepth) : null;
  const footprint = blockFootprint ?? plotFootprint;
  const emsal = areaProduct(project.arsa_alani, project.kaks);
  const defaultArea = footprint ?? (emsal === null || floorCount === 0 ? null : emsal / floorCount);
  const basementParkingBlocked = locks?.basementParking.disabled ?? false;
  const serviceArea = serviceBasement && basementFloors > 0 && !basementParkingBlocked ? design.floorAreas[`basement-${basementFloors}`] ?? defaultArea : 0;
  const commercial = rules?.use === 'commercial';
  const explicitGroundShop = ground && Array.from({ length: columns }, (_, column) => design.units[`ground:${column}`]?.type === 'shop').some(Boolean);
  const commercialGround = commercial || rules?.use === 'ground-commercial' || (rules?.use === 'mixed' && rules.noGroundResidence);
  const groundLobby = rules?.noGroundResidence && !commercialGround && !explicitGroundShop;
  const selected = new Set(design.contractorFloors);
  const floors: SectionFloor[] = [];

  function addFloor(id: string, label: string, kind: SectionFloor['kind'], order: number, service = false, inset = false, serviceLabel?: string) {
    const hasUnits = !service && (kind !== 'roof' || independentRoof);
    const floorOverride = kind === 'roof' && !independentRoof ? undefined : design.floorAreas[id];
    const estimatedArea = floorOverride ?? (kind === 'roof' && !independentRoof ? 0 : defaultArea);
    const unitArea = estimatedArea === null ? null : estimatedArea / columns;
    const units: SectionUnit[] = [];
    const contractor = hasUnits && selected.has(id);
    if (hasUnits) {
      const isBasement = kind === 'basement';
      const basementResidenceLocked = id === 'basement-1' ? locks?.basement1Residence.disabled : locks?.basement2Residence.disabled;
      const residenceBlocked = (kind === 'ground' && locks?.groundResidence.disabled)
        || (kind === 'normal' && locks?.commercialUpperResidence.disabled)
        || (isBasement && (locks?.basementHabitation.disabled || basementResidenceLocked));
      const allowedTypes = UNIT_TYPES.filter(type => {
        if (kind === 'roof') return type === 'apartment';
        if (isResidence(type)) return !residenceBlocked;
        if (type === 'shop') return !(isBasement && locks?.basementHabitation.disabled);
        return !(type === 'parking' && isBasement && basementParkingBlocked);
      });
      const connectToRoof = roofUsage === 'duplex' && id === duplexFloor;
      const defaultType: UnitType = allowedTypes.includes('apartment')
        ? connectToRoof ? 'duplex' : 'apartment'
        : !isBasement && allowedTypes.includes('shop') ? 'shop' : 'storage';
      for (let column = 0; column < columns; column++) {
        const unitId = `${id}:${column}`;
        const override = design.units[unitId];
        const overriddenTypeAllowed = override?.type === undefined || allowedTypes.includes(override.type);
        const chosenType = overriddenTypeAllowed ? override?.type ?? defaultType : defaultType;
        const type = connectToRoof && chosenType === 'apartment' ? 'duplex' : chosenType;
        const number = order * columns + column + 1;
        const title = (overriddenTypeAllowed ? override?.title : undefined) || (kind === 'roof' ? 'ÇATI KATI DAİRESİ' : `${number} NOLU ${unitLabels[type]}`);
        const gross = override?.gross ?? unitArea;
        units.push({ id: unitId, title, type, allowedTypes, net: override?.net ?? null, gross, totalGross: null, roofArrow: connectToRoof && type === 'duplex', isContractorShare: isShareableUnit(type) && (override?.isContractorShare ?? contractor) });
      }
    }
    const derivedArea = units.length === 0 ? estimatedArea : units.every(unit => unit.gross !== null)
      ? units.reduce((sum, unit) => sum + unit.gross!, 0) : null;
    const area = kind === 'roof' ? derivedArea : floorOverride ?? derivedArea;
    floors.push({ id, label, kind, service, serviceLabel, inset: inset && (!service || kind === 'ground'), contractor, area, units });
  }

  const residentialBasementCount = basementFloors - Number(serviceBasement && basementFloors > 0);
  if (roofShape) addFloor('roof', roofLabels[roofUsage], 'roof', residentialBasementCount + Number(ground) + normalFloors);
  const inset = projection !== 'none';
  for (let floor = normalFloors; floor > 0; floor--) {
    addFloor(`normal-${floor}`, `${floor}. NORMAL KAT`, 'normal', residentialBasementCount + Number(ground) + floor - 1);
  }
  if (ground) addFloor('ground', 'ZEMİN KAT', 'ground', residentialBasementCount, !!groundLobby, inset, groundLobby ? 'GİRİŞ HOLÜ / ORTAK ALAN' : undefined);
  for (let floor = 1; floor <= basementFloors; floor++) {
    const service = serviceBasement && floor === basementFloors;
    addFloor(`basement-${floor}`, `${floor}. BODRUM KAT`, 'basement', residentialBasementCount - floor, service, inset && floor === 1, service && basementParkingBlocked ? 'SIĞINAK / TEKNİK ALAN' : undefined);
  }
  const allUnits = floors.flatMap(floor => floor.units);
  if (roofUsage === 'duplex') {
    const roof = floors.find(floor => floor.kind === 'roof');
    const connectedUnits = allUnits.filter(unit => unit.roofArrow);
    if (roof && connectedUnits.length > 0) {
      roof.area = design.floorAreas.roof ?? 0;
      const unitRoofArea = roof.area / connectedUnits.length;
      for (const unit of connectedUnits) {
        unit.roofArea = unitRoofArea;
        if (unit.gross !== null) unit.gross += unitRoofArea;
      }
    }
  }
  const apartments = allUnits.filter(unit => isResidence(unit.type));
  const sharedArea = apartments.length > 0 && serviceArea !== null ? serviceArea / apartments.length : null;
  for (const unit of allUnits) {
    unit.totalGross = unit.gross === null ? null : !isResidence(unit.type) ? unit.gross : sharedArea === null ? null : unit.gross + sharedArea;
  }
  const totalArea = floorCount > 0 && floors.every(floor => floor.area !== null) ? floors.reduce((sum, floor) => sum + floor.area!, 0) : null;
  const totalUnits = allUnits.filter(unit => isShareableUnit(unit.type)).length;
  return { floors, totalArea, totalUnits, totalFloors: floorCount, projection, roofShape, roofUsage };
}
