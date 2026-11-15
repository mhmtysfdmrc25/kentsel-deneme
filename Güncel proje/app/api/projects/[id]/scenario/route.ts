import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateScenario } from '@/lib/scenario';
export const runtime = 'nodejs';
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  let scenario;
  try { scenario = validateScenario(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz senaryo.' }, { status: 400 }); }
  try {
    const result = db.prepare("UPDATE projects SET architectural_scenarios = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(scenario), Number(id));
    if (!result.changes) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(id)));
  } catch (error) {
    console.error('Senaryo kaydedilemedi:', error);
    return NextResponse.json({ error: 'Senaryo kaydedilemedi.' }, { status: 500 });
  }
}
