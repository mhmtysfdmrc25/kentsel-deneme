import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { projectFields, validateProject, type Project } from '@/lib/projects';
import { MAX_BUILDINGS, validateBuildings } from '@/lib/buildings';
import { validateMeasure } from '@/lib/metraj';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  try {
    const projects = db.prepare('SELECT * FROM projects').all() as Project[];
    const collator = new Intl.Collator('tr', { sensitivity: 'base', numeric: true });
    projects.sort((a, b) => collator.compare(String(a.semt ?? ''), String(b.semt ?? '')) || collator.compare(String(a.ada ?? ''), String(b.ada ?? '')) || a.id - b.id);
    return NextResponse.json(projects);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Projeler yüklenemedi.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let values, buildings, measure: string | null = null;
  try {
    const body = await request.json();
    values = validateProject(body);
    if (typeof values.bina_sayisi === 'number' && values.bina_sayisi > MAX_BUILDINGS) throw new Error('Bina sayısı en fazla 100 olabilir.');
    buildings = validateBuildings(body.binalar_detay, values.bina_sayisi as number | null);
    if (body.daire_metraj_detaylari != null) measure = JSON.stringify(validateMeasure(JSON.parse(buildings ?? '[]'), values.insaat_alani as number, body.daire_metraj_detaylari));
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz istek.' }, { status: 400 }); }
  try {
    const result = db.prepare(`INSERT INTO projects (${projectFields.join(', ')}, binalar_detay, daire_metraj_detaylari) VALUES (${projectFields.map(() => '?').join(', ')}, ?, ?)`).run(...projectFields.map(key => values[key]), buildings, measure);
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid), { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Proje kaydedilemedi.' }, { status: 500 });
  }
}
