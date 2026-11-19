import type { Project } from './projects';
import type { Scenario } from './scenario';
import type { BuildingDesign, Section, SectionUnit } from './simulator';

export const ruleLabels = {
  use: { residential: 'Konut', 'ground-commercial': 'Zemin Ticaret + Üstü Konut', mixed: 'Ticaret + Konut (Karma)', commercial: 'Tamamen Ticaret' },
  order: { detached: 'Ayrık', attached: 'Bitişik', block: 'Blok / İkiz' },
  regime: { kaks: 'KAKS Esaslı', taks: 'TAKS × Kat Adedi', block: 'Blok Ebatı' },
  projection: { none: 'Çıkma Yok', open: 'Açık Çıkma', closed: 'Kapalı Çıkma', mixed: 'Açık + Kapalı Karma', column: 'Kolonlu Arka/Ön Genişleme' },
  roof: { void: 'Çatı Boşluğu (Ortak/Kullanımsız)', duplex: 'Çatı Arası Piyesi (Son Kat Dubleks)', mansard: 'Mansard (Kırık) Çatı', terrace: 'Teras / Yeşil Çatı' },
  geology: { standard: 'Standart', oa1: 'OA1 (4–5 kat)', oa2: 'OA2 (2 kat)', 'oa3-5': 'OA3–OA5 (3 kat)', je: 'JE / Afete Maruz' },
} as const;

type ChoiceKey = keyof typeof ruleLabels;
type Choice<K extends ChoiceKey> = keyof (typeof ruleLabels)[K];
export type RuleSettings = {
  use: Choice<'use'>;
  order: Choice<'order'>;
  frontGarden: boolean;
  sideGarden: boolean;
  rearGarden: boolean;
  regime: Choice<'regime'>;
  isolation: boolean;
  subasman: number;
  mezzanine: boolean;
  portico: boolean;
  noGroundResidence: boolean;
  stepped: boolean;
  projection: Choice<'projection'>;
  roof: Choice<'roof'>;
  geology: Choice<'geology'>;
  flood: boolean;
  infrastructure: boolean;
  solidFuel: boolean;
  sideProjection?: boolean;
  basementOpenings?: boolean;
  basementParking?: boolean;
  blockWidth?: number | null;
  blockDepth?: number | null;
  siteElevationDelta?: number | null;
  floodCrest?: number | null;
  basementOpeningElevation?: number | null;
  totalBuriedTechnicalArea?: number | null;
};

export const DEFAULT_RULE_SETTINGS: Readonly<RuleSettings> = {
  use: 'residential', order: 'detached', frontGarden: true, sideGarden: true, rearGarden: true,
  regime: 'kaks', isolation: false, subasman: 0, mezzanine: false, portico: false,
  noGroundResidence: false, stepped: false, projection: 'none', roof: 'void',
  geology: 'standard', flood: false, infrastructure: false, solidFuel: false,
};

const choices = ['use', 'order', 'regime', 'projection', 'roof', 'geology'] as const;
const requiredFlags = ['frontGarden', 'sideGarden', 'rearGarden', 'isolation', 'mezzanine', 'portico', 'noGroundResidence', 'stepped', 'flood', 'infrastructure', 'solidFuel'] as const;
const optionalFlags = ['sideProjection', 'basementOpenings', 'basementParking'] as const;
const measurements = ['blockWidth', 'blockDepth', 'siteElevationDelta', 'floodCrest', 'basementOpeningElevation', 'totalBuriedTechnicalArea'] as const;

function validateChoice<K extends ChoiceKey>(key: K, value: unknown): RuleSettings[K] {
  if (typeof value !== 'string' || !Object.hasOwn(ruleLabels[key], value)) throw new Error('Geçersiz imar senaryosu seçimi.');
  return value as RuleSettings[K];
}

function setChoice<K extends ChoiceKey>(output: RuleSettings, key: K, value: unknown) {
  output[key] = validateChoice(key, value);
}

export function validateRuleSettings(value: unknown): RuleSettings {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error('Geçersiz imar senaryosu.');
  const data = value as Record<string, unknown>;
  const output: RuleSettings = { ...DEFAULT_RULE_SETTINGS };
  for (const key of choices) {
    if (data[key] !== undefined) setChoice(output, key, data[key]);
  }
  for (const key of [...requiredFlags, ...optionalFlags]) {
    const input = data[key];
    if (input === undefined) continue;
    if (typeof input !== 'boolean') throw new Error('Geçersiz imar senaryosu seçimi.');
    output[key] = input;
  }
  for (const key of measurements) {
    const input = data[key];
    if (input === undefined) continue;
    const min = key === 'floodCrest' || key === 'basementOpeningElevation' ? -10000 : 0;
    const max = key === 'totalBuriedTechnicalArea' ? 1_000_000_000 : 10_000;
    if (input !== null && (typeof input !== 'number' || !Number.isFinite(input) || input < min || input > max)) {
      throw new Error('Geçersiz imar senaryosu ölçüsü.');
    }
    output[key] = input;
  }
  if (data.subasman !== undefined) {
    if (typeof data.subasman !== 'number' || !Number.isFinite(data.subasman) || data.subasman < 0 || data.subasman > 1.2) {
      throw new Error('Subasman 0,00 ile 1,20 metre arasında olmalıdır.');
    }
    output.subasman = data.subasman;
  }
  return output;
}

export type RuleLock = { disabled: boolean; reason: string };

const lock = (reason?: string): RuleLock => ({ disabled: !!reason, reason: reason ?? '' });
const hasGroundTrade = (design: BuildingDesign, settings: RuleSettings) => design.ground && (
  settings.use === 'ground-commercial' || settings.use === 'commercial'
  || (settings.use === 'mixed' && settings.noGroundResidence)
  || Object.entries(design.units).some(([id, unit]) => /^ground:[0-5]$/u.test(id)
    && Number(id.at(-1)) < design.columns && unit.type === 'shop')
);

const numeric = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null;

function multiply(left: unknown, right: unknown) {
  const a = numeric(left);
  const b = numeric(right);
  return a === null || b === null ? null : numeric(a * b);
}

export function locksFor(project: Project, design: BuildingDesign, settings: RuleSettings, scenario: Scenario) {
  const sevenPlus = design.normalFloors >= 7 && settings.use !== 'commercial';
  const closed = sevenPlus ? 'PAİY m. 5/30-b · Konut içeren binalarda zemin hariç 7+ katta kapalı çıkma yapılamaz.' : undefined;
  const netEmsal = multiply(project.arsa_alani, project.kaks);
  const taksFootprint = multiply(project.arsa_alani, project.taks);
  const blockFootprint = settings.regime === 'block' ? multiply(settings.blockWidth, settings.blockDepth) : null;
  const footprint = blockFootprint ?? taksFootprint;
  const aboveGround = Array.from({ length: design.normalFloors }, (_, index) => `normal-${index + 1}`);
  if (design.ground) aboveGround.push('ground');
  const estimated = footprint === null ? null : aboveGround.reduce((total, id) => {
    if (design.floorAreas[id] !== undefined) return total + design.floorAreas[id];
    return total + Array.from({ length: design.columns }, (_, column) => design.units[`${id}:${column}`]?.gross ?? footprint / design.columns)
      .reduce((area, item) => area + item, 0);
  }, 0);
  const column = !sevenPlus ? 'Bu alternatif konut içeren zemin hariç 7+ katlı ve emsali dolmayan senaryolar içindir.'
    : netEmsal === null || estimated === null ? 'Kolonlu genişleme için arsa alanı, TAKS ve KAKS bilgilerini girin.'
    : estimated >= netEmsal ? 'Üst kat ve zemin tahmininde emsal hakkı dolduğu için kolonlu genişleme pasif.'
    : undefined;
  const floodMinimum = settings.floodCrest == null ? null : settings.floodCrest + 1.5;
  const floodRestriction = !settings.flood ? undefined
    : floodMinimum === null || settings.basementOpeningElevation == null ? 'PAİY m. 5/10 · Kret ve en düşük bodrum kullanım/açıklık kotları girilene kadar iskân, açıklıklar ve otopark girişi kilitli.'
    : floodMinimum - settings.basementOpeningElevation > 1e-9 ? 'PAİY m. 5/10 · Kret +1,50 m kotunun altında iskân, kapı/pencere ve otopark giriş-çıkışı yapılamaz.'
    : undefined;
  const ground = hasGroundTrade(design, settings);
  const attached = settings.order === 'attached';
  const commercial = settings.use === 'commercial' ? 'Seçilen kullanım fonksiyonu tamamen ticarettir.' : undefined;
  const flatFirst = !scenario.slope && settings.subasman < 1
    ? 'İİY m. 18 ve PAİY m. 51 · Düz arazide 1. bodrum konutu için simülatörün +1,00 m subasman ön koşulu sağlanmıyor.' : undefined;
  return {
    projectionClosed: lock(closed),
    projectionMixed: lock(closed),
    projectionColumn: lock(column),
    mezzanine: lock(!design.ground ? 'Asma kat için zemin kat gerekir.' : ground && settings.use !== 'commercial'
      ? 'PAİY m. 5/30-a · Konut altındaki ticari zeminde asma kat yapılamaz.'
      : 'İİY m. 28/1-e · İstanbul’da sanayi ve küçük sanayi bölgeleri dışında asma kat yapılamaz.'),
    sideGarden: lock(attached ? 'PAİY m. 41 ve İİY m. 45 · Bitişik sınırda yan bahçe öngörülmez.' : undefined),
    sideProjection: lock(attached ? 'PAİY m. 41 ve İİY m. 45 · Bitişik sınırda yan cephe çıkması uygulanmaz.' : undefined),
    portico: lock(!design.ground || !attached || settings.frontGarden ? 'PAİY m. 4 ve m. 45 · Portik için zemin kat, bitişik nizam ve ön bahçesiz yerleşim gerekir. Portikli güzergâhı uygulama imar planı belirler.' : undefined),
    groundResidence: lock(commercial ?? (settings.use === 'ground-commercial' || settings.noGroundResidence ? 'Bu senaryoda zemin kat konut olarak ayrılmadı.' : undefined)),
    commercialUpperResidence: lock(commercial),
    basement1Residence: lock(floodRestriction ?? commercial ?? (ground
      ? 'PAİY m. 51 ve İİY m. 18 · Ticari zeminin altındaki 1. bodrumda konut seçilemez.' : flatFirst)),
    basement2Residence: lock(floodRestriction ?? commercial ?? (!scenario.slope
      ? 'İİY m. 18 ve PAİY m. 51 · Düz arazide 2. ve daha derin bodrumlarda konut ön senaryoda kapalıdır.' : undefined)),
    basementHabitation: lock(floodRestriction),
    basementOpenings: lock(floodRestriction),
    basementParking: lock(floodRestriction),
  };
}

export function normalizeRuleSettings(project: Project, design: BuildingDesign, settings: RuleSettings, scenario: Scenario): RuleSettings {
  const locks = locksFor(project, design, settings, scenario);
  let projection = settings.projection;
  if ((projection === 'closed' && locks.projectionClosed.disabled) || (projection === 'mixed' && locks.projectionMixed.disabled)) projection = 'open';
  if (projection === 'column' && locks.projectionColumn.disabled) projection = 'none';
  return {
    ...settings, projection,
    mezzanine: settings.mezzanine && !locks.mezzanine.disabled,
    portico: settings.portico && !locks.portico.disabled,
    sideGarden: settings.sideGarden && !locks.sideGarden.disabled,
    ...(settings.sideProjection !== undefined && { sideProjection: settings.sideProjection && !locks.sideProjection.disabled }),
    ...(settings.basementOpenings !== undefined && { basementOpenings: settings.basementOpenings && !locks.basementOpenings.disabled }),
    ...(settings.basementParking !== undefined && { basementParking: settings.basementParking && !locks.basementParking.disabled }),
    stepped: settings.stepped && scenario.slope && (settings.siteElevationDelta == null || settings.siteElevationDelta > 3.5),
  };
}

export const imarSources = {
  paiy: 'https://www.mevzuat.gov.tr/mevzuatmetin/yonetmelik/7.5.23722.pdf',
  paiy2026: 'https://www.resmigazete.gov.tr/eskiler/2026/07/20260701-7.htm',
  iiy: 'https://www.resmigazete.gov.tr/eskiler/2026/04/20260408-3.htm',
  shelter: 'https://www.resmigazete.gov.tr/eskiler/2025/11/20251107-2.htm',
  social: 'https://www.resmigazete.gov.tr/eskiler/2025/08/20250813-1.htm',
  rainwater: 'https://meslekihizmetler.csb.gov.tr/haberler/planli-alanlar-imar-yonetmeligi-guncellendi-290883',
  avcilar: 'https://www.avcilar.bel.tr/sayfa/imar-basvurulari',
  avcilarRoof: 'https://avcilar.bel.tr/proje/cati-katlarina-iliskin-1-1000-olcekli-uygulama-imar-plani-plan-notu-degisiklikleri-ambarli-merkez-denizkoskler-cihangir-gumuspala-universite-mustafa-kemal-pasa-firuzkoy-yesilkent-mahalleleri',
};

export type LegalNote = {
  id: string;
  category: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  source?: string;
};

type Share = { count: number; area: number | null; percent: number | null };

function sumArea(areas: (number | null)[]): number | null {
  return areas.some(area => area === null) ? null : areas.reduce<number>((sum, area) => sum + (area ?? 0), 0);
}

function isDwelling(unit: SectionUnit) {
  return unit.type === 'apartment' || unit.type === 'duplex';
}

function share(units: SectionUnit[], totalArea: number | null): Share {
  const area = sumArea(units.map(unit => unit.gross));
  return { count: units.length, area, percent: area !== null && totalArea !== null && totalArea > 0 ? area / totalArea * 100 : null };
}

export function evaluateImarRules(project: Project, design: BuildingDesign, section: Section, settings: RuleSettings, scenario: Scenario) {
  const locks = locksFor(project, design, settings, scenario);
  settings = normalizeRuleSettings(project, design, settings, scenario);
  const parcelArea = numeric(project.arsa_alani);
  const netEmsal = multiply(parcelArea, project.kaks);
  const footprint = multiply(parcelArea, project.taks);
  const planFloors = design.normalFloors + Number(design.ground);
  const blockArea = multiply(settings.blockWidth, settings.blockDepth);
  const regimeArea = settings.regime === 'block' ? multiply(blockArea, planFloors)
    : settings.regime === 'taks' ? multiply(footprint, planFloors) : netEmsal;
  const bonusPool = multiply(netEmsal, scenario.bonus ? 0.3 : 0);
  const bonusArea = netEmsal === null || bonusPool === null ? null : netEmsal + bonusPool;
  const aboveGroundFootprint = settings.regime === 'block' ? blockArea : footprint;
  const exposedBasements = scenario.slope && scenario.exposedFloors !== null ? Math.min(scenario.exposedFloors, design.basementFloors) : null;
  const slopeArea = multiply(aboveGroundFootprint, exposedBasements);
  const gardenArea = parcelArea === null || aboveGroundFootprint === null ? null : Math.max(0, parcelArea - aboveGroundFootprint);
  const avcilar = typeof project.semt === 'string' && project.semt.trim().toLocaleLowerCase('tr-TR') === 'avcılar';
  const treeInterval = avcilar ? 25 : 30;
  const treeCount = gardenArea === null ? null : Math.ceil(gardenArea / treeInterval);
  const setbackIncrease = Math.max(0, planFloors + (exposedBasements ?? 0) - 4) * 0.5;
  const nationalSetbackIncrease = setbackIncrease;
  const exemptArea = settings.totalBuriedTechnicalArea ?? null;
  const estimatedEmsalUse = section.totalArea === null ? null : Math.max(0, section.totalArea - (exemptArea ?? 0));
  const emsalExcess = estimatedEmsalUse === null || bonusArea === null ? null : Math.max(0, estimatedEmsalUse - bonusArea);

  const floors = section.floors.filter(floor => floor.kind !== 'roof');
  const buriedTechnicalArea = scenario.slope && exposedBasements === null ? null : sumArea(floors
    .filter(floor => floor.kind === 'basement' && Number(floor.id.slice('basement-'.length)) > (exposedBasements ?? 0))
    .map(floor => floor.service ? floor.area : sumArea(floor.units.filter(unit => unit.type === 'parking' || unit.type === 'storage').map(unit => unit.gross))));
  const units = floors.flatMap(floor => floor.units);
  const dwellingCount = units.filter(isDwelling).length;
  const offices = units.filter(unit => unit.type === 'shop');
  const workplaceArea = sumArea(offices.map(unit => unit.gross));
  const shares = units.filter(unit => isDwelling(unit) || unit.type === 'shop');
  const shareArea = sumArea(shares.map(unit => unit.gross));
  const owner = share(shares.filter(unit => !unit.isContractorShare), shareArea);
  const contractor = share(shares.filter(unit => unit.isContractorShare), shareArea);
  const eligibleBasements = floors.filter(floor => floor.kind === 'basement' && (floor.service || floor.units.length > 0)).length;
  const includedFloors = planFloors + eligibleBasements;
  const upperDwellings = floors.filter(floor => floor.kind === 'normal').flatMap(floor => floor.units).filter(isDwelling).length;

  const legalNotes: LegalNote[] = [];
  function note(id: string, category: string, severity: LegalNote['severity'], message: string, source?: string) {
    legalNotes.push({ id, category, severity, message, ...(source && { source }) });
  }

  if (scenario.narrow && scenario.heightLimit) {
    note('lost-emsal', 'Kısıt çatışması', 'critical', 'Kayıp Emsal Riski · Dar arsa ve yükseklik sınırı birlikte emsalin tamamının kullanılmasını güçleştirebilir.');
  } else if (scenario.narrow) {
    note('narrow', 'Kısıt çatışması', 'warning', 'Taban oturumu daralabilir. Emsali doldurmak için kat sayısını artırmanız gerekebilir.');
  } else if (scenario.heightLimit) {
    note('height', 'Kısıt çatışması', 'warning', 'Kat sınırı var. Emsali doldurmak için TAKS kullanımını değerlendirin.');
  }
  if (settings.flood) {
    note('flood', 'Zemin ve altyapı', locks.basementHabitation.disabled ? 'critical' : 'warning',
      locks.basementHabitation.reason || 'PAİY m. 5/10 · Girilen en düşük kot kret +1,50 m ön kontrolünü geçiyor. Kullanım, açıklık ve otopark giriş kotlarını kurum görüşüyle doğrulayın.', imarSources.paiy);
  }
  if (emsalExcess !== null && emsalExcess > 0.005) {
    note('emsal-excess', 'İmar hesabı', 'warning', `Kesit alanının ${emsalExcess.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} m²’si tahmini emsal sınırını aşıyor. Kalemleri emsal cetvelinde sınıflandırın.`, imarSources.iiy);
  }
  if (exemptArea !== null && section.totalArea !== null && exemptArea > section.totalArea) {
    note('exempt-area', 'İmar hesabı', 'warning', 'Beyan edilen emsal dışı alan kesit toplamını aşıyor. Emsal dışı alan girişini kontrol edin.', imarSources.iiy);
  }

  const singleDwelling = dwellingCount === 1 && offices.length === 0;
  if (!singleDwelling && (planFloors >= 10 || upperDwellings > 20)) {
    note('elevator-dual', 'Erişilebilirlik', 'warning',
      `PAİY m. 34 · Zemin kat üzerinde 20’den fazla konutta veya plan kararı 10+ kat ise en az iki asansör gerekir.${planFloors >= 10 ? ' Plan kat adedini doğrulayın.' : ''}`, imarSources.paiy2026);
  } else if (!singleDwelling && includedFloors >= 4) {
    note('elevator', 'Erişilebilirlik', 'warning', 'PAİY m. 34 · Bağımsız bölüm, eklenti veya ortak alan içeren bodrumlar dahil 4+ katta asansör gerekir.', imarSources.paiy2026);
  } else if (!singleDwelling && includedFloors === 3) {
    note('elevator-place', 'Erişilebilirlik', 'warning', 'PAİY m. 34 · Bağımsız bölüm, eklenti veya ortak alan içeren bodrumlar dahil 3 katta asansör yeri ayrılır.', imarSources.paiy2026);
  }
  if (!singleDwelling && includedFloors >= 10) {
    note('stretcher-elevator', 'Erişilebilirlik', 'warning', 'PAİY m. 34/5 · 10+ katlı binada en az bir asansör yük, eşya ve sedye taşımaya uygun olmalı. Uygulanacak kat adedini doğrulayın.', imarSources.paiy);
  }

  if (dwellingCount >= 10 || ((settings.use !== 'residential' || offices.length > 0) && estimatedEmsalUse !== null && estimatedEmsalUse >= 1500)) {
    note('shelter', 'Ortak alan ve donatı', 'warning', 'Sığınak Yönetmeliği m. 7 · 10+ konut veya karma/ticari yapıda 1.500 m² emsale konu alan eşiği. Yerleşim için alt bodrumu, geçiş hükümlerini ve istisnaları kontrol edin.', imarSources.shelter);
  } else if ((section.totalArea !== null && section.totalArea > 1500) || shares.length > 12) {
    note('shelter-screening', 'Ortak alan ve donatı', 'info', 'Sığınak ön taraması · Kesit alanı veya bölüm sayısı çalışma eşiğini geçti. Yapı türüne göre konut adedini ve emsale konu alanı resmi eşiğe göre kontrol edin.', imarSources.shelter);
  }
  const caretakerUnits = settings.solidFuel ? Number(dwellingCount > 40)
    : dwellingCount > 150 ? Math.ceil(dwellingCount / 150) : Number(dwellingCount > 60);
  if (caretakerUnits > 0) {
    note('caretaker', 'Ortak alan ve donatı', 'warning', `PAİY m. 44 · Isıtma türü ve konut sayısına göre ${caretakerUnits} kapıcı dairesi öngörülür. Bina içindeki her daire için en az 50 m² brüt ayırın.`, imarSources.paiy);
  }
  if ((settings.use === 'commercial' && section.totalArea !== null && section.totalArea > 2000)
    || (workplaceArea !== null && workplaceArea > 2000)) {
    note('guard', 'Ortak alan ve donatı', 'warning', 'PAİY m. 44 · Yapı inşaat alanı 2.000 m²’yi aşan işyeri/büro binalarında bekçi odası ayrılır. Karma kullanımda kapsamı teyit edin.', imarSources.paiy);
  }
  if (parcelArea !== null && parcelArea > 1000) {
    note('cistern', 'Su yönetimi', 'warning', 'İİY m. 40 · Parsel 1.000 m²’yi aşıyor. Yağmur suyu sarnıcı şartını kontrol edin.', imarSources.iiy);
  }
  if ((parcelArea !== null && parcelArea > 2000) || (aboveGroundFootprint !== null && aboveGroundFootprint > 1000)) {
    note('rainwater', 'Su yönetimi', 'warning', 'PAİY m. 57/A · Parsel veya tahmini çatı izdüşümü yağmur suyu eşiğini aşıyor. Uygulanabilirlik için 7 m³ üzeri depo ihtiyacını ve geçici hükümleri doğrulayın.', imarSources.rainwater);
  }
  if (shares.length > 75 && settings.use !== 'commercial') {
    note('social', 'Ortak alan ve donatı', 'warning', 'PAİY m. 19 · 75’i aşan bağımsız bölüm bulunan konut parsellerinde mescit ve çocuk oyun alanı ayrılır. Parselin plan kullanımını doğrulayın.', imarSources.paiy);
  }
  if (settings.use === 'residential' && dwellingCount > 150 && section.totalArea !== null && section.totalArea > 15000) {
    note('childcare', 'Ortak alan ve donatı', 'warning', 'PAİY m. 19/f-5 · Konut senaryosu gündüz bakımevi eşiklerini aşıyor. Geçici m. 3/9 kapsamındaki başvuru ve 6306 istisnalarını kontrol edin.', imarSources.social);
  }
  if ((settings.use === 'mixed' || settings.use === 'ground-commercial') && shares.length > 250 && section.totalArea !== null && section.totalArea > 25000) {
    note('healthcare', 'Ortak alan ve donatı', 'warning', 'PAİY m. 19/f-6 · Konut ve ticaret senaryosu aile sağlığı merkezi eşiklerini aşıyor. Geçici hükümleri ve parsel kullanım kararını kontrol edin.', imarSources.social);
  }

  if (settings.geology !== 'standard') {
    const geologyCaps = { oa1: 4, oa2: 2, 'oa3-5': 3, je: 0 };
    if (planFloors > geologyCaps[settings.geology] || settings.geology === 'je') {
      note('geology', 'Zemin ve altyapı', settings.geology === 'je' ? 'critical' : 'warning',
        `${ruleLabels.geology[settings.geology]} · Kullanıcının seçtiği ön tarama bölgesinde parsel bazlı onaylı zemin etüdü, yürürlükteki 1/1000 plan notu ve yetkili idare görüşü gerekir.`, imarSources.avcilar);
    }
  }
  if (settings.infrastructure) {
    note('infrastructure', 'Zemin ve altyapı', 'warning', 'BOTAŞ / İSKİ / TEİAŞ koruma bandı · İlgili kurumun görüşünü alın ve onaylı koruma koridorunu imar paftasına işleyin.', imarSources.avcilar);
  }
  if (locks.projectionClosed.disabled) note('closed-projection', 'Çıkma', 'info', locks.projectionClosed.reason, imarSources.paiy);
  if (settings.projection === 'column') {
    note('column', 'Çıkma', 'info', 'PAİY m. 5/30-b · Duvarsız genişlemede önce arka bahçe (en az 2 m kalır), yetmezse ön cephe (yola en az 4 m) değerlendirilir. Taşma en fazla 1 m.', imarSources.paiy);
  }
  if (settings.use === 'ground-commercial' || settings.use === 'mixed') {
    note('mixed-ground', 'Zemin kat', 'info', 'PAİY m. 5/30-a · Konut altındaki ticari zemin 4,50 m’den düşük olmalı. Asma kat yapılamaz, taşıyıcı sistem şartları ayrıca uygulanır.', imarSources.paiy);
  } else if (settings.use === 'commercial') {
    note('mezzanine', 'Zemin kat', 'info', locks.mezzanine.reason, imarSources.iiy);
  }
  if (design.basementFloors > 0 && hasGroundTrade(design, settings)) {
    note('basement-use', 'Bodrum kullanımı', 'info', 'PAİY m. 51 ve İİY m. 18 · Ticari zeminin altındaki 1. bodrumda konut seçimi açık değildir.', imarSources.iiy);
  } else if (design.basementFloors > 0 && !scenario.slope) {
    note('basement-flat', 'Bodrum kullanımı', 'info', 'İİY m. 18 · Düz arazi taramasında 1. bodrum için +1,00 m subasman ön koşulu kullanılır. İskân için cephe, zemin ve kot şartlarını ayrıca doğrulayın.', imarSources.iiy);
  }
  if (settings.order === 'attached' || settings.order === 'block') {
    note('seismic-joint', 'Yapı nizamı', 'info', 'PAİY m. 5/30-c · Bitişik sınırda deprem derzi, komşu yapı ve taşıyıcı sistem koşullarına göre statik projede belirlenir.', imarSources.paiy);
  }
  if (settings.portico) {
    note('portico', 'Yapı nizamı', 'info', 'PAİY m. 45 · Portik uygulanacak cadde ve sokakları uygulama imar planı belirler. Parsel planını doğrulayın.', imarSources.paiy);
  }
  if (settings.isolation) {
    note('isolation', 'İmar hesabı', 'info', 'PAİY m. 5/8 · Deprem yalıtım katı için en çok 2,40 m ön kabulü gösterilir. Teknik şartlar ve emsal sınıflandırması projede doğrulanır.', imarSources.paiy);
  }
  if (settings.stepped) {
    note('stepped', 'Zemin ve altyapı', 'info', 'Kademeli yerleşim, 3,50 m’yi aşan kot farkı senaryosudur. Kotlandırma ve kademe sınırlarını onaylı plan üzerinden kontrol edin.', imarSources.iiy);
  }
  if (settings.order !== 'attached') {
    note('garden', 'Bahçe ve peyzaj', 'info', `İİY ve PAİY m. 23 · Plan aksini belirtmiyorsa yan/arka çekmede dört katı aşan her kat +0,50 m (ön tahmin +${setbackIncrease.toLocaleString('tr-TR')} m). Cephe kotlarını doğrulayın.`, imarSources.iiy);
    note('taks', 'İmar hesabı', 'info', 'PAİY m. 5/6 · Ayrık/blok nizamda plan TAKS belirtmezse üst sınır %40. KAKS verilmemişse, çekmelere göre hesaplanan emsal hakkı içinde TAKS en çok %60 olabilir.', imarSources.paiy2026);
  }
  if (treeCount !== null) {
    note('tree', 'Bahçe ve peyzaj', 'info', `Açık bahçe tahmini, her ${treeInterval} m² için 1 ağaç varsayımıyla ${treeCount} ağaç veriyor. Parselin yürürlükteki plan notuyla doğrulayın.`, avcilar ? imarSources.avcilar : imarSources.paiy);
  }
  note('roof', 'Çatı', 'info', avcilar
    ? 'Simülatör çatı piyesini son kata bağlar. Bağımsız çatı katı için Avcılar’ın onaylı 1/1000 çatı plan notunun kapsadığı parselleri kontrol edin.'
    : 'PAİY m. 40 · Çatı piyesi son kattaki bağımsız bölüme bağlıdır. Çatı biçimi ve kullanımı için parselin yürürlükteki plan notunu kontrol edin.', avcilar ? imarSources.avcilarRoof : imarSources.paiy);
  if (scenario.bonus || exemptArea !== null) {
    note('exemptions', 'İmar hesabı', 'info', 'PAİY m. 5/8 ve İİY m. 22 · %30 havuz yalnızca uygun kalemler içindir. Beyan edilen gömülü/teknik alanların havuz dışı tutulabilmesi için kapsamı ayrı ayrı doğrulayın.', imarSources.iiy);
  }
  return {
    locks,
    calculations: {
      netEmsal, bonusPool, bonusArea, regimeArea, footprint, slopeArea, exemptArea, estimatedEmsalUse,
      buriedTechnicalArea, gardenArea, treeInterval, treeCount, setbackIncrease, nationalSetbackIncrease,
      owner, contractor, emsalExcess, includedFloors, dwellings: dwellingCount, workplaceArea,
    },
    legalNotes,
  };
}

export type ImarEvaluation = ReturnType<typeof evaluateImarRules>;
