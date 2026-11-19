import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { validateSimulator } from '@/lib/simulator';
export const runtime = 'nodejs';
export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const id = (await context.params).id;
  if (!/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id))) return NextResponse.json({ error: 'Geçersiz proje kimliği.' }, { status: 400 });
  let scenario;
  try { scenario = validateSimulator(await request.json()); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Geçersiz senaryo.' }, { status: 400 }); }
  try {
    const result = db.prepare(
      `UPDATE projects SET architectural_scenarios = CASE
        WHEN @keepDesign AND json_valid(architectural_scenarios) THEN
          CASE WHEN json_type(architectural_scenarios, '$.design') = 'object'
            THEN json_set(@data, '$.design', json_extract(architectural_scenarios, '$.design'))
            ELSE @data END
        ELSE @data END, updated_at = datetime('now') WHERE id = @id`,
    ).run({ keepDesign: Number(scenario.design === undefined), data: JSON.stringify(scenario), id: Number(id) });
    if (!result.changes) return NextResponse.json({ error: 'Proje bulunamadı.' }, { status: 404 });
    return NextResponse.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(id)));
  } catch (error) {
    console.error('Senaryo kaydedilemedi:', error);
    return NextResponse.json({ error: 'Senaryo kaydedilemedi.' }, { status: 500 });
  }
}
