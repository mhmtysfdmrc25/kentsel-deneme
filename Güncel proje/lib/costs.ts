import type { Project } from './projects';
export type Mode = 'quick' | 'detailed';
export type Quick = { parking: boolean; parkingArea: number | null; parkingRate: number | null; structureRate: number | null; demolition: number | null; rent: number | null; fees: number | null };
export type CostRow = { id: string; name: string; quantity: number | null; unit: string; price: number | null };
export const emptyQuick = (): Quick => ({ parking: false, parkingArea: null, parkingRate: null, structureRate: null, demolition: null, rent: null, fees: null });
export function projectArea(project: Project): number | null {
  if (project.daire_metraj_detaylari) {
    try { const value = JSON.parse(project.daire_metraj_detaylari).toplam_genel_brut; if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value; } catch { /* Use recorded construction area. */ }
  }
  return typeof project.insaat_alani === 'number' && Number.isFinite(project.insaat_alani) && project.insaat_alani >= 0 ? project.insaat_alani : null;
}
export function quickTotal(area: number | null, q: Quick): number | null {
  if (area === null || q.structureRate === null || q.demolition === null || q.rent === null || q.fees === null || (q.parking && (q.parkingArea === null || q.parkingRate === null || q.parkingArea > area))) return null;
  const parkingArea = q.parking ? q.parkingArea! : 0;
  const total = (area - parkingArea) * q.structureRate + parkingArea * (q.parking ? q.parkingRate! : 0) + q.demolition + q.rent + q.fees;
  return Number.isFinite(total) ? total : null;
}
export function detailedTotal(rows: CostRow[]): number | null {
  if (rows.some(r => r.quantity === null || r.price === null)) return null;
  const total = rows.reduce((sum, row) => sum + row.quantity! * row.price!, 0);
  return Number.isFinite(total) ? total : null;
}
export function savedCostTotal(project: Project | null): number | null {
  if (!project?.cost_mode) return null;
  try { return project.cost_mode === 'quick' ? quickTotal(projectArea(project), JSON.parse(project.quick_cost_data ?? 'null')) : project.cost_mode === 'detailed' ? detailedTotal(JSON.parse(project.detailed_cost_data ?? 'null')) : null; } catch { return null; }
}
export function savedQuickAid(project: Project, costTotal: number | null): number | null {
  if (project.cost_mode !== 'quick' || costTotal === null || !project.quick_cost_data) return null;
  try {
    const { rent } = JSON.parse(project.quick_cost_data);
    return typeof rent === 'number' && Number.isFinite(rent) && rent >= 0 && rent <= costTotal ? rent : null;
  } catch {
    return null;
  }
}
function numeric(value: unknown): value is number | null { return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0); }
export function validateCosts(data: unknown, area: number | null) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Geçersiz maliyet verileri.');
  const input = data as { mode?: unknown; quick?: unknown; detailed?: unknown };
  if (input.mode !== 'quick' && input.mode !== 'detailed') throw new Error('Geçersiz maliyet modu.');
  if (!input.quick || typeof input.quick !== 'object' || Array.isArray(input.quick)) throw new Error('Geçersiz hızlı fizibilite verisi.');
  const q = input.quick as Record<string, unknown>;
  const keys = ['parkingArea', 'parkingRate', 'structureRate', 'demolition', 'rent', 'fees'] as const;
  if (typeof q.parking !== 'boolean' || !keys.every(key => numeric(q[key]))) throw new Error('Maliyetler sıfır veya daha büyük geçerli sayılar olmalıdır.');
  if (!Array.isArray(input.detailed) || !input.detailed.every((r: unknown) => {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
    const row = r as Record<string, unknown>;
    return typeof row.id === 'string' && row.id.length > 0 && row.id.length <= 100 && typeof row.name === 'string' && row.name.length <= 200 && typeof row.unit === 'string' && row.unit.length <= 50 && numeric(row.quantity) && numeric(row.price);
  })) throw new Error('Keşif kalemleri geçersiz.');
  const quick = { parking: q.parking as boolean, ...Object.fromEntries(keys.map(key => [key, q[key]])) } as Quick;
  const detailed = input.detailed.map((r: CostRow) => ({ id: r.id, name: r.name, quantity: r.quantity, unit: r.unit, price: r.price }));
  if (input.mode === 'quick' && quick.parking && quick.parkingArea !== null && area !== null && quick.parkingArea > area) throw new Error('Otopark alanı toplam inşaat alanını aşamaz.');
  if (input.mode === 'quick' && quickTotal(area, quick) === null) throw new Error('Hızlı fizibilite için toplam alanı ve tüm maliyet alanlarını doldurun.');
  if (input.mode === 'detailed' && (!detailed.length || detailed.some((r: CostRow) => !r.name.trim() || !r.unit.trim()) || detailedTotal(detailed) === null)) throw new Error('En az bir kalem ekleyip tüm satır alanlarını doldurun.');
  return { mode: input.mode as Mode, quick, detailed };
}
