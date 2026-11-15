import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { projectArea, validateCosts } from '@/lib/costs';
import type { Project } from '@/lib/projects';
export const runtime = 'nodejs';
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const rawId = (await context.params).id;
  if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(Number(rawId))) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(rawId)) as Project | undefined;
  if (!project) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
  let costs;
  try { costs = validateCosts(await request.json(), projectArea(project)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz maliyet verileri.' }, { status: 400 }); }
  try {
    db.prepare("UPDATE projects SET cost_mode = ?, quick_cost_data = ?, detailed_cost_data = ?, updated_at = datetime('now') WHERE id = ?").run(costs.mode, JSON.stringify(costs.quick), JSON.stringify(costs.detailed), project.id);
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(project.id));
  } catch (error) {
    console.error('Maliyet kaydedilemedi:', error);
    return NextResponse.json({ error: 'Maliyetler kaydedilemedi.' }, { status: 500 });
  }
}
