import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateFinancialScenario } from '@/lib/financial';

export const runtime = 'nodejs';

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const projectId = Number(id);
  if (!/^[1-9]\d*$/u.test(id) || !Number.isSafeInteger(projectId)) {
    return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  }
  let scenario;
  try { scenario = validateFinancialScenario(await request.json()); }
  catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz finansal senaryo.' }, { status: 400 });
  }
  try {
    const result = db.prepare(
      "UPDATE projects SET financial_scenarios = ?, updated_at = datetime('now') WHERE id = ? RETURNING *",
    ).get(JSON.stringify(scenario), projectId);
    if (!result) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Finansal senaryo kaydedilemedi:', error);
    return NextResponse.json({ error: 'Finansal senaryo kaydedilemedi.' }, { status: 500 });
  }
}
