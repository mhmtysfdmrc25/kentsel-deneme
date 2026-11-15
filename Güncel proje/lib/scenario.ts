import type { Project } from './projects';
export type Scenario = { bonus: boolean; slope: boolean; exposedFloors: number | null; projection: boolean; projectionType: '' | 'open' | 'closed'; narrow: boolean; heightLimit: boolean };
export const emptyScenario = (): Scenario => ({ bonus: false, slope: false, exposedFloors: null, projection: false, projectionType: '', narrow: false, heightLimit: false });
export function validateScenario(value: unknown): Scenario {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Geçersiz senaryo.');
  const s = value as Record<string, unknown>;
  if (!['bonus', 'slope', 'projection', 'narrow', 'heightLimit'].every(k => typeof s[k] === 'boolean')) throw new Error('Senaryo seçimleri geçersiz.');
  if (s.exposedFloors !== null && (typeof s.exposedFloors !== 'number' || !Number.isInteger(s.exposedFloors) || s.exposedFloors < 0 || s.exposedFloors > 100)) throw new Error('Açığa çıkan kat sayısı 0 ile 100 arasında bir tam sayı olmalıdır.');
  if (!['', 'open', 'closed'].includes(String(s.projectionType))) throw new Error('Çıkma türü geçersiz.');
  return { bonus: s.bonus as boolean, slope: s.slope as boolean, exposedFloors: s.exposedFloors as number | null, projection: s.projection as boolean, projectionType: s.projectionType as Scenario['projectionType'], narrow: s.narrow as boolean, heightLimit: s.heightLimit as boolean };
}
export function projectStats(project: Project) {
  let buildings: { daire_sayisi?: number | null; dukkan_sayisi?: number | null; normal_kat?: number | null; bodrum_kat?: number | null; giriste_daire_yok?: boolean }[] = [];
  try { const parsed = JSON.parse(project.binalar_detay ?? '[]'); if (Array.isArray(parsed)) buildings = parsed; } catch { /* Eksik veriyi bilinmiyor olarak göster. */ }
  const units = typeof project.daire_sayisi === 'number' && typeof project.dukkan_sayisi === 'number' ? project.daire_sayisi + project.dukkan_sayisi : buildings.length && buildings.every(b => typeof b.daire_sayisi === 'number' && typeof b.dukkan_sayisi === 'number') ? buildings.reduce((sum, b) => sum + b.daire_sayisi! + b.dukkan_sayisi!, 0) : null;
  // Çok binalı projede kat sayıları toplanmaz; risk taramasında en yüksek bina kullanılır.
  const floors = buildings.length && buildings.every(b => typeof b.normal_kat === 'number' && typeof b.bodrum_kat === 'number') ? Math.max(...buildings.map(b => b.normal_kat! + b.bodrum_kat! + (b.giriste_daire_yok === undefined && b.normal_kat! > 0 ? 0 : 1))) : null;
  const base = typeof project.arsa_alani === 'number' && typeof project.taks === 'number' ? project.arsa_alani * project.taks : null;
  const kaksArea = typeof project.arsa_alani === 'number' && typeof project.kaks === 'number' ? project.arsa_alani * project.kaks : null;
  return { units, floors, base, kaksArea };
}
export function simulate(project: Project, scenario: Scenario) {
  const stats = projectStats(project);
  return {
    ...stats,
    gross: stats.kaksArea === null ? null : stats.kaksArea * (scenario.bonus ? 1.3 : 1),
    slopeArea: scenario.slope && scenario.exposedFloors !== null && stats.base !== null ? stats.base * scenario.exposedFloors : null,
    constraint: scenario.narrow && scenario.heightLimit ? 'both' : scenario.narrow ? 'narrow' : scenario.heightLimit ? 'height' : 'none',
    shelter: (typeof project.insaat_alani === 'number' && project.insaat_alani > 1500) || (stats.units !== null && stats.units > 12),
    elevator: stats.floors !== null && stats.floors >= 4,
    highRise: stats.floors !== null && stats.floors >= 10,
    caretaker: stats.units !== null && stats.units > 30,
  };
}
