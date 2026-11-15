import { distributionError, type Building } from './buildings';

export type Apartment = { net: number | null; brut: number | null; kat_brut: number | null; genel_brut: number | null };
export type Floor = { id: string; ad: string; ortak_alan: number | null; daireler: Apartment[] };
export type BuildingMeasure = { bina_index: number; bina_adi: string; katlar: Floor[] };
export type Measure = { binalar: BuildingMeasure[]; toplam_insaat_alani: number; toplam_kat_brut: number | null; artan_alan: number | null; toplam_genel_brut: number | null };

export function buildMeasure(buildings: Building[], area: number, previous?: Measure | null): Measure {
  const result: BuildingMeasure[] = buildings.map((b, index) => {
    const error = distributionError(b);
    if (error) throw new Error(`${index + 1}. bina: ${error}`);
    const totalFloors = (b.normal_kat ?? 0) + (b.giriste_daire_yok ? 0 : 1) + (b.bodrumda_daire_yok ? 0 : (b.bodrum_kat ?? 0));
    const equalCount = totalFloors ? (b.daire_sayisi ?? 0) / totalFloors : 0;
    const floors = [
      ...(!b.bodrumda_daire_yok ? Array.from({length: b.bodrum_kat ?? 0}, (_, i) => ({ id: `bodrum-${i + 1}`, ad: `${i + 1}. Bodrum Kat`, count: b.esit_dagilim ? equalCount : b.bodrum_daireleri[i] ?? 0 })).reverse() : []),
      ...Array.from({length: (b.normal_kat ?? 0) + 1}, (_, i) => ({ id: `normal-${i}`, ad: i === 0 ? 'Giriş Kat' : `${i}. Kat`, count: b.esit_dagilim ? equalCount : b.kat_daireleri[i] ?? 0 })).filter((_, i) => !b.giriste_daire_yok || i !== 0)
    ];
    return { bina_index: index, bina_adi: b.ad || `${index + 1}. Bina`, katlar: floors.map(f => {
      const old = previous?.binalar?.find(item => item.bina_index === index)?.katlar?.find(item => item.id === f.id);
      return { id: f.id, ad: f.ad, ortak_alan: old?.ortak_alan ?? null, daireler: Array.from({length: f.count}, (_, i) => ({ net: old?.daireler?.[i]?.net ?? null, brut: old?.daireler?.[i]?.brut ?? null, kat_brut: null, genel_brut: null })) };
    }) };
  });
  const floors = result.flatMap(b => b.katlar);
  const apartments = floors.flatMap(f => f.daireler);
  for (const f of floors) for (const a of f.daireler) if (a.brut !== null && f.ortak_alan !== null) a.kat_brut = a.brut + f.ortak_alan / f.daireler.length;
  const complete = apartments.length > 0 && floors.every(f => f.daireler.length === 0 || f.ortak_alan !== null) && apartments.every(a => a.net !== null && a.brut !== null);
  if (!complete) return { binalar: result, toplam_insaat_alani: area, toplam_kat_brut: null, artan_alan: null, toplam_genel_brut: null };
  const sum = apartments.reduce((s, a) => s + a.kat_brut!, 0);
  const remainder = area - sum;
  for (const a of apartments) a.genel_brut = a.kat_brut! + remainder / apartments.length;
  return { binalar: result, toplam_insaat_alani: area, toplam_kat_brut: sum, artan_alan: remainder, toplam_genel_brut: apartments.reduce((s, a) => s + a.genel_brut!, 0) };
}

export function validateMeasure(buildings: Building[], area: number, input: unknown): Measure {
  if (!Number.isFinite(area) || area <= 0) throw new Error('İnşaat alanı sıfırdan büyük olmalıdır.');
  if (!input || typeof input !== 'object' || !Array.isArray((input as Measure).binalar)) throw new Error('Geçersiz metraj bilgisi.');
  const data = input as Measure;
  for (const b of data.binalar) {
    if (!b || !Array.isArray(b.katlar)) throw new Error('Geçersiz bina metrajı.');
    for (const f of b.katlar) {
      if (!f || !Array.isArray(f.daireler)) throw new Error('Geçersiz kat metrajı.');
      if (f.daireler.length === 0) continue;
      for (const n of [f.ortak_alan, ...f.daireler.flatMap(a => [a.net, a.brut])]) if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) throw new Error('Tüm metraj alanlarına sıfır veya daha büyük bir sayı girin.');
      if (f.daireler.some(a => a.net! > a.brut!)) throw new Error('Daire net alanı brüt alanından büyük olamaz.');
    }
  }
  const calculated = buildMeasure(buildings, area, data);
  if (calculated.toplam_genel_brut === null || calculated.artan_alan === null) throw new Error('Tüm metraj alanlarını doldurun.');
  if (calculated.artan_alan < -0.000001) throw new Error('Kat brütleri toplamı toplam inşaat alanını aşamaz.');
  if (Math.abs(calculated.toplam_genel_brut - area) > 0.000001 * Math.max(1, area)) throw new Error('Genel brüt toplamı inşaat alanıyla eşleşmiyor.');
  return calculated;
}
