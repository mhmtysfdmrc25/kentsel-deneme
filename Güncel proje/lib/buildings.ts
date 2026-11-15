export type Building = {
  ad: string;
  daire_sayisi: number | null;
  dukkan_sayisi: number | null;
  bodrum_kat: number | null;
  normal_kat: number | null;
  esit_dagilim: boolean;
  kat_daireleri: (number | null)[];
  bodrumda_daire_yok: boolean;
  bodrum_daireleri: (number | null)[];
  giriste_daire_yok: boolean;
};
export const MAX_BUILDINGS = 100;
export const MAX_FLOORS = 100;
export function emptyBuilding(): Building {
  return { ad: '', daire_sayisi: null, dukkan_sayisi: null, bodrum_kat: null, normal_kat: null, esit_dagilim: false, kat_daireleri: [], bodrumda_daire_yok: false, bodrum_daireleri: [], giriste_daire_yok: false };
}
export function distributionError(b: Building): string | null {
  if (b.daire_sayisi === null || b.bodrum_kat === null || b.normal_kat === null) return 'Daire ve kat sayılarını doldurun.';
  const floors = [...(b.bodrumda_daire_yok ? [] : b.bodrum_daireleri), ...(b.giriste_daire_yok ? b.kat_daireleri.slice(1) : b.kat_daireleri)];
  if (b.esit_dagilim) return floors.length > 0 && b.daire_sayisi % floors.length === 0 ? null : 'Daire sayısı seçilen katlara eşit bölünmüyor.';
  if (floors.some(value => value === null) || floors.reduce<number>((sum, value) => sum + (value ?? 0), 0) !== b.daire_sayisi) return 'Girilen dairelerin toplamı, mevcut daire sayısıyla eşleşmiyor!';
  return null;
}
export function validateBuildings(value: unknown, count: number | null): string | null {
  // Eski istemciler bina detayını göndermediğinde mevcut kayıt korunur.
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > MAX_BUILDINGS || value.length !== (count ?? 0)) throw new Error('Bina detayları bina sayısıyla eşleşmelidir.');
  const buildings = value.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Geçersiz bina bilgisi.');
    const b = raw as Record<string, unknown>;
    if (typeof b.ad !== 'string' || b.ad.trim().length > 100) throw new Error('Bina adı en fazla 100 karakter olmalıdır.');
    const countValue = (key: string, max = Number.MAX_SAFE_INTEGER): number | null => {
      const n = b[key];
      if (n === null) return null;
      if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > max) throw new Error('Bina ve kat sayıları geçerli, negatif olmayan tam sayılar olmalıdır.');
      return n;
    };
    const daire = countValue('daire_sayisi');
    const dukkan = countValue('dukkan_sayisi');
    const bodrum = countValue('bodrum_kat', MAX_FLOORS);
    const normal = countValue('normal_kat', MAX_FLOORS);
    if (daire === null && (bodrum !== null || normal !== null)) throw new Error('Kat sayılarından önce daire sayısını girin.');
    if (typeof b.esit_dagilim !== 'boolean' || !Array.isArray(b.kat_daireleri)) throw new Error('Geçersiz kat dağılımı.');
    const floors = b.kat_daireleri;
    const legacy = b.giriste_daire_yok === undefined;
    const noGround = legacy ? (normal ?? 0) === 0 : b.giriste_daire_yok;
    if (typeof noGround !== 'boolean') throw new Error('Geçersiz giriş katı seçimi.');
    const normalizedFloors = legacy && normal === 0 ? [null] : floors;
    const normalCount = legacy && normal !== null && normal > 0 ? normal - 1 : normal;
    if (normalizedFloors.length !== (normalCount === null ? 0 : normalCount + 1) || normalizedFloors.some(n => n !== null && (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0))) throw new Error('Kat dağılımı geçersiz.');
    const noBasement = b.bodrumda_daire_yok === undefined ? true : b.bodrumda_daire_yok;
    const basement = b.bodrum_daireleri === undefined ? Array(bodrum ?? 0).fill(null) : b.bodrum_daireleri;
    if (typeof noBasement !== 'boolean' || !Array.isArray(basement) || basement.length !== (bodrum ?? 0) || basement.some(n => n !== null && (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0))) throw new Error('Bodrum dağılımı geçersiz.');
    const total = (normalCount ?? 0) + (noGround ? 0 : 1) + (noBasement ? 0 : (bodrum ?? 0));
    if (b.esit_dagilim && (daire === null || !total || daire % total !== 0)) throw new Error('Daire sayısı seçilen katlara tam ve eşit bölünmelidir.');
    const assigned = [...(noBasement ? [] : basement), ...(noGround ? normalizedFloors.slice(1) : normalizedFloors)];
    if (!b.esit_dagilim && assigned.length && assigned.every(n => n !== null) && assigned.reduce((sum: number, n: number) => sum + n, 0) !== daire) throw new Error('Katlardaki dairelerin toplamı bina daire sayısına eşit olmalıdır.');
    return { ad: b.ad.trim(), daire_sayisi: daire, dukkan_sayisi: dukkan, bodrum_kat: bodrum, normal_kat: normalCount, esit_dagilim: b.esit_dagilim, kat_daireleri: normalizedFloors, bodrumda_daire_yok: noBasement, bodrum_daireleri: basement, giriste_daire_yok: noGround };
  });
  return JSON.stringify(buildings);
}
