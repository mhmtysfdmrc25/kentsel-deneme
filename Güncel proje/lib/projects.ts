export const textFields = ['semt', 'mahalle', 'ada', 'parsel'] as const;
export const numberFields = ['arsa_alani', 'taks', 'kaks', 'bina_sayisi', 'daire_sayisi', 'dukkan_sayisi', 'insaat_alani'] as const;
export const projectFields = [...textFields, ...numberFields, 'imar_tipi', 'riskli_yapi', 'notlar'] as const;
export type Field = typeof projectFields[number];
export type Project = Record<Field, string | number | null> & { id: number; created_at: string | null; updated_at: string | null; binalar_detay: string | null; daire_metraj_detaylari: string | null; cost_mode: string | null; quick_cost_data: string | null; detailed_cost_data: string | null; architectural_scenarios: string | null; financial_scenarios: string | null };
export function projectName(project: Project) {
  const parcel = [project.ada != null && project.ada !== '' ? `${project.ada} Ada` : '', project.parsel != null && project.parsel !== '' ? `${project.parsel} Parsel` : ''].filter(Boolean).join(' ');
  const district = [project.semt, project.mahalle].filter(Boolean).join(' / ');
  const location = [district, parcel].filter(Boolean).join(' · ');
  return location || `İsimsiz proje #${project.id}`;
}
export function validateProject(input: unknown): Record<Field, string | number | null> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Geçersiz proje bilgileri.');
  const data = input as Record<string, unknown>;
  const output = {} as Record<Field, string | number | null>;
  for (const key of textFields) {
    const value = data[key];
    if (value == null || value === '') output[key] = null;
    else if (typeof value !== 'string' || value.trim().length > 100) throw new Error('Metin alanları en fazla 100 karakter olmalıdır.');
    else output[key] = value.trim() || null;
  }
  for (const key of numberFields) {
    const value = data[key];
    if (value == null || value === '') { output[key] = null; continue; }
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (key.endsWith('sayisi') && !Number.isSafeInteger(value))) throw new Error('Sayısal alanlar geçerli ve sıfırdan küçük olmayan değerler içermelidir; adetler tam sayı olmalıdır.');
    output[key] = value;
  }
  if (data.notlar == null || data.notlar === '') output.notlar = null;
  else if (typeof data.notlar !== 'string' || data.notlar.length > 10000) throw new Error('Proje notu en fazla 10.000 karakter olmalıdır.');
  else output.notlar = data.notlar.trim() || null;
  for (const [key, choices] of [['imar_tipi', ['Konut', 'Ticaret', 'Karma']], ['riskli_yapi', ['Evet', 'Hayır']]] as const) {
    const value = data[key];
    if (value == null || value === '') output[key] = null;
    else if (typeof value !== 'string' || !choices.some(choice => choice === value)) throw new Error('Geçersiz seçim.');
    else output[key] = value;
  }
  return output;
}
