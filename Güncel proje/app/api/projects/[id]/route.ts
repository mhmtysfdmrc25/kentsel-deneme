import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { projectFields, validateProject } from '@/lib/projects';
import { MAX_BUILDINGS, validateBuildings } from '@/lib/buildings';
import { validateMeasure } from '@/lib/metraj';
export const runtime = 'nodejs';
type RouteContext = { params: Promise<{ id: string }> };
async function getId(context: RouteContext) {
  const raw = (await context.params).id;
  return /^[1-9]\d*$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : null;
}
export async function PUT(request: Request, context: RouteContext) {
  const id = await getId(context);
  if (!id) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  let values, buildings, measure: string | null = null, hasMeasure = false;
  try {
    const body = await request.json();
    values = validateProject(body);
    if (typeof values.bina_sayisi === 'number' && values.bina_sayisi > MAX_BUILDINGS) throw new Error('Bina sayısı en fazla 100 olabilir.');
    buildings = validateBuildings(body.binalar_detay, values.bina_sayisi as number | null);
    hasMeasure = Object.prototype.hasOwnProperty.call(body, 'daire_metraj_detaylari');
    const existing = db.prepare('SELECT binalar_detay, daire_metraj_detaylari FROM projects WHERE id = ?').get(id) as { binalar_detay: string | null; daire_metraj_detaylari: string | null } | undefined;
    if (!existing) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    const requested = hasMeasure ? body.daire_metraj_detaylari : existing.daire_metraj_detaylari ? JSON.parse(existing.daire_metraj_detaylari) : null;
    if (requested !== null) measure = JSON.stringify(validateMeasure(JSON.parse(buildings ?? existing.binalar_detay ?? '[]'), values.insaat_alani as number, requested));
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz istek.' }, { status: 400 }); }
  try {
    const result = db.prepare(`UPDATE projects SET ${projectFields.map(key => `${key} = ?`).join(', ')}, binalar_detay = COALESCE(?, binalar_detay), daire_metraj_detaylari = ?, updated_at = datetime('now') WHERE id = ?`).run(...projectFields.map(key => values[key]), buildings, measure, id);
    if (!result.changes) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(id));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Proje güncellenemedi.' }, { status: 500 });
  }
}
export async function DELETE(_request: Request, context: RouteContext) {
  const id = await getId(context);
  if (!id) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  try {
    const result = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    if (!result.changes) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Proje silinemedi.' }, { status: 500 });
  }
}
